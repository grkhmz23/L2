use anchor_lang::prelude::*;
use crate::error::SableError;
use crate::state::{AgentCounters, CounterpartyMode, SpendPolicy};

/// Validate a spend against policy and return updated counters.
///
/// Check order (as documented in architecture):
/// 1. expires_at — reject if policy has expired and expires_at != 0.
/// 2. counterparty_mode — if AllowlistOnly, reject if counterparty not in allowed list.
/// 3. allowed_mints — reject if mint not in allowed list (and list is not all-zero).
/// 4. per_tx_limit — reject if amount > per_tx_limit (and limit != 0).
/// 5. daily_limit — reject if spent_today + amount > daily_limit (and limit != 0).
///    Rolls over spent_today if the day has changed.
/// 6. total_limit — reject if spent_total + amount > total_limit (and limit != 0).
pub fn validate_spend(
    policy: &SpendPolicy,
    counters: &AgentCounters,
    now: i64,
    amount: u64,
    mint: &Pubkey,
    counterparty_pubkey: &Pubkey,
) -> Result<AgentCounters> {
    // 1. Expiry check
    if policy.expires_at != 0 && now > policy.expires_at {
        return Err(error!(SableError::PolicyExpired));
    }

    // 2. Counterparty mode check
    if policy.counterparty_mode == CounterpartyMode::AllowlistOnly {
        let mut allowed = false;
        for cp in &policy.allowed_counterparties {
            if *cp == Pubkey::default() {
                continue; // slot unused
            }
            if cp == counterparty_pubkey {
                allowed = true;
                break;
            }
        }
        if !allowed {
            return Err(error!(SableError::CounterpartyNotAllowed));
        }
    }

    // 3. Allowed mints check
    let mut has_any_mint = false;
    let mut mint_allowed = false;
    for m in &policy.allowed_mints {
        if *m == Pubkey::default() {
            continue; // slot unused
        }
        has_any_mint = true;
        if m == mint {
            mint_allowed = true;
            break;
        }
    }
    if has_any_mint && !mint_allowed {
        return Err(error!(SableError::MintNotAllowed));
    }

    // 4. Per-transaction limit check
    if policy.per_tx_limit != 0 && amount > policy.per_tx_limit {
        return Err(error!(SableError::PerTxLimitExceeded));
    }

    // 5. Daily limit check (with rollover)
    let day_index = now / 86400;
    let (spent_today, current_day) = if day_index != counters.current_day {
        // Day rolled over — reset spent_today
        (0i64, day_index)
    } else {
        (counters.spent_today as i64, counters.current_day)
    };

    let new_spent_today = spent_today
        .checked_add(amount as i64)
        .ok_or(SableError::Overflow)?;

    if policy.daily_limit != 0 && new_spent_today > policy.daily_limit as i64 {
        return Err(error!(SableError::DailyLimitExceeded));
    }

    // 6. Total lifetime limit check
    let new_spent_total = counters
        .spent_total
        .checked_add(amount)
        .ok_or(SableError::Overflow)?;

    if policy.total_limit != 0 && new_spent_total > policy.total_limit {
        return Err(error!(SableError::TotalLimitExceeded));
    }

    Ok(AgentCounters {
        agent: counters.agent,
        bump: counters.bump,
        spent_total: new_spent_total,
        spent_today: new_spent_today as u64,
        current_day,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_counters() -> AgentCounters {
        AgentCounters {
            agent: Pubkey::new_unique(),
            bump: 0,
            spent_total: 0,
            spent_today: 0,
            current_day: 0,
        }
    }

    fn open_policy() -> SpendPolicy {
        SpendPolicy {
            per_tx_limit: 0,
            daily_limit: 0,
            total_limit: 0,
            counterparty_mode: CounterpartyMode::Any,
            allowed_counterparties: [Pubkey::default(); 4],
            allowed_mints: [Pubkey::default(); 4],
            expires_at: 0,
        }
    }

    #[test]
    fn zero_cap_means_unlimited() {
        let policy = open_policy();
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, 1_000_000, u64::MAX, &mint, &cp).unwrap();
        assert_eq!(result.spent_total, u64::MAX);
        assert_eq!(result.spent_today, u64::MAX);
    }

    #[test]
    fn day_rollover_resets_spent_today() {
        let policy = open_policy();
        let mut counters = dummy_counters();
        counters.spent_today = 500;
        counters.current_day = 10;

        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();
        let now = 11 * 86400; // day 11

        let result = validate_spend(&policy, &counters, now, 100, &mint, &cp).unwrap();
        assert_eq!(result.spent_today, 100); // reset, not 600
        assert_eq!(result.current_day, 11);
        assert_eq!(result.spent_total, 100);
    }

    #[test]
    fn no_rollover_on_same_day() {
        let policy = open_policy();
        let mut counters = dummy_counters();
        counters.spent_today = 500;
        counters.current_day = 10;

        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();
        let now = 10 * 86400 + 100; // still day 10

        let result = validate_spend(&policy, &counters, now, 100, &mint, &cp).unwrap();
        assert_eq!(result.spent_today, 600);
        assert_eq!(result.current_day, 10);
    }

    #[test]
    fn policy_expired() {
        let mut policy = open_policy();
        policy.expires_at = 1000;
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let err = validate_spend(&policy, &counters, 1001, 1, &mint, &cp).unwrap_err();
        assert_eq!(err, error!(SableError::PolicyExpired));
    }

    #[test]
    fn not_expired_when_expires_at_zero() {
        let policy = open_policy();
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, i64::MAX, 1, &mint, &cp);
        assert!(result.is_ok());
    }

    #[test]
    fn counterparty_allowlist_rejects() {
        let mut policy = open_policy();
        policy.counterparty_mode = CounterpartyMode::AllowlistOnly;
        // allowed_counterparties stays all-zero = empty allowlist
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let err = validate_spend(&policy, &counters, 100, 1, &mint, &cp).unwrap_err();
        assert_eq!(err, error!(SableError::CounterpartyNotAllowed));
    }

    #[test]
    fn counterparty_allowlist_accepts() {
        let mut policy = open_policy();
        policy.counterparty_mode = CounterpartyMode::AllowlistOnly;
        let allowed_cp = Pubkey::new_unique();
        policy.allowed_counterparties[0] = allowed_cp;
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, 100, 1, &mint, &allowed_cp);
        assert!(result.is_ok());
    }

    #[test]
    fn mint_allowlist_rejects() {
        let mut policy = open_policy();
        let allowed_mint = Pubkey::new_unique();
        policy.allowed_mints[0] = allowed_mint;
        let counters = dummy_counters();
        let bad_mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let err = validate_spend(&policy, &counters, 100, 1, &bad_mint, &cp).unwrap_err();
        assert_eq!(err, error!(SableError::MintNotAllowed));
    }

    #[test]
    fn mint_allowlist_accepts() {
        let mut policy = open_policy();
        let allowed_mint = Pubkey::new_unique();
        policy.allowed_mints[0] = allowed_mint;
        let counters = dummy_counters();
        let cp = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, 100, 1, &allowed_mint, &cp);
        assert!(result.is_ok());
    }

    #[test]
    fn mint_allowlist_all_zero_means_unrestricted() {
        let policy = open_policy(); // allowed_mints all zero
        let counters = dummy_counters();
        let any_mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, 100, 1, &any_mint, &cp);
        assert!(result.is_ok());
    }

    #[test]
    fn per_tx_limit_exceeded() {
        let mut policy = open_policy();
        policy.per_tx_limit = 100;
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let err = validate_spend(&policy, &counters, 100, 101, &mint, &cp).unwrap_err();
        assert_eq!(err, error!(SableError::PerTxLimitExceeded));
    }

    #[test]
    fn per_tx_limit_exactly_at_limit() {
        let mut policy = open_policy();
        policy.per_tx_limit = 100;
        let counters = dummy_counters();
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, 100, 100, &mint, &cp);
        assert!(result.is_ok());
    }

    #[test]
    fn daily_limit_exceeded() {
        let mut policy = open_policy();
        policy.daily_limit = 1000;
        let mut counters = dummy_counters();
        counters.spent_today = 600;
        counters.current_day = 5;
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();
        let now = 5 * 86400; // same day

        let err = validate_spend(&policy, &counters, now, 401, &mint, &cp).unwrap_err();
        assert_eq!(err, error!(SableError::DailyLimitExceeded));
    }

    #[test]
    fn daily_limit_exactly_at_limit() {
        let mut policy = open_policy();
        policy.daily_limit = 1000;
        let mut counters = dummy_counters();
        counters.spent_today = 600;
        counters.current_day = 5;
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();
        let now = 5 * 86400;

        let result = validate_spend(&policy, &counters, now, 400, &mint, &cp);
        assert!(result.is_ok());
    }

    #[test]
    fn total_limit_exceeded() {
        let mut policy = open_policy();
        policy.total_limit = 5000;
        let mut counters = dummy_counters();
        counters.spent_total = 3000;
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let err = validate_spend(&policy, &counters, 100, 2001, &mint, &cp).unwrap_err();
        assert_eq!(err, error!(SableError::TotalLimitExceeded));
    }

    #[test]
    fn total_limit_exactly_at_limit() {
        let mut policy = open_policy();
        policy.total_limit = 5000;
        let mut counters = dummy_counters();
        counters.spent_total = 3000;
        let mint = Pubkey::new_unique();
        let cp = Pubkey::new_unique();

        let result = validate_spend(&policy, &counters, 100, 2000, &mint, &cp);
        assert!(result.is_ok());
    }
}
