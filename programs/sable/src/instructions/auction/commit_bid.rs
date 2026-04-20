use anchor_lang::prelude::*;
use crate::error::SableError;
use crate::events::BidCommitted;
use crate::policy::validate_spend;
use crate::state::{
    AgentBalance, AgentCounters, AgentState, Bid, BidderKind, ParentKind, Task, TaskEscrow,
    TaskState, UserBalance, UserState,
};

pub const BID_SEED: &str = "bid";

#[derive(Accounts)]
#[instruction(bidder_kind: BidderKind, commit_hash: [u8; 32], deposit: u64)]
pub struct CommitBid<'info> {
    #[account(mut)]
    pub bidder_owner: Signer<'info>,

    /// CHECK: Bidder account (UserState or AgentState), validated in instruction
    #[account(mut)]
    pub bidder: AccountInfo<'info>,

    /// CHECK: Bidder balance account (UserBalance or AgentBalance), validated in instruction
    #[account(mut)]
    pub bidder_balance: AccountInfo<'info>,

    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [
            crate::instructions::auction::create_task::TASK_ESCROW_SEED.as_bytes(),
            task.key().as_ref(),
        ],
        bump = task_escrow.bump,
    )]
    pub task_escrow: Account<'info, TaskEscrow>,

    #[account(
        init,
        payer = bidder_owner,
        space = 8 + Bid::SIZE,
        seeds = [
            BID_SEED.as_bytes(),
            task.key().as_ref(),
            bidder.key().as_ref(),
        ],
        bump
    )]
    pub bid: Account<'info, Bid>,

    /// CHECK: Mint account validated against bidder_balance
    pub mint: AccountInfo<'info>,

    /// CHECK: Agent counters, only used/validated when bidder is an Agent
    #[account(mut)]
    pub agent_counters: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Commit a sealed bid to a task.
///
/// * `bidder_kind` — User or Agent.
/// * `commit_hash` — keccak256(amount_le || nonce_le || bidder_pubkey).
/// * `deposit` — skin-in-game amount, must be >= task.min_deposit.
pub fn commit_bid(
    ctx: Context<CommitBid>,
    bidder_kind: BidderKind,
    commit_hash: [u8; 32],
    deposit: u64,
) -> Result<()> {
    require!(deposit > 0, SableError::InvalidAmount);

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    let task = &mut ctx.accounts.task;
    let task_escrow = &mut ctx.accounts.task_escrow;

    // Task must be Open
    require!(task.state == TaskState::Open, SableError::TaskWrongState);

    // Must be within commit window
    require!(now < task.bid_commit_deadline, SableError::TaskDeadlineInvalid);

    // Deposit must meet minimum
    require!(deposit >= task.min_deposit, SableError::DepositBelowMinimum);

    // Escrow must match task
    require!(task_escrow.task == task.key(), SableError::TaskEscrowMismatch);

    // Mint consistency
    require!(task.mint == ctx.accounts.mint.key(), SableError::InvalidMint);

    let bidder_key = ctx.accounts.bidder.key();
    let signer = ctx.accounts.bidder_owner.key();
    let mint_key = ctx.accounts.mint.key();

    // Validate bidder, debit balance
    let bidder_data = ctx.accounts.bidder.try_borrow_data()?;

    if bidder_kind == BidderKind::User {
        let bidder_state = UserState::try_deserialize(&mut &bidder_data[..])
            .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;
        require!(bidder_state.owner == signer, SableError::NotAuthorized);

        debit_bidder_user_balance(&ctx.accounts.bidder_balance, bidder_key, mint_key, deposit)?;
    } else {
        let bidder_state = AgentState::try_deserialize(&mut &bidder_data[..])
            .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;

        require!(bidder_state.owner == signer, SableError::AgentNotAuthorized);
        require!(
            !bidder_state.frozen && !bidder_state.revoked,
            SableError::AgentFrozenOrRevoked
        );

        // Verify ancestor chain if depth > 1
        if bidder_state.parent_kind == ParentKind::Agent {
            crate::instructions::agent::verify_ancestors_not_frozen(
                &bidder_state,
                &bidder_key,
                ctx.remaining_accounts,
                ctx.program_id,
            )?;
        }

        // Validate agent_counters PDA
        let (expected_counters, _) = Pubkey::find_program_address(
            &[
                crate::AGENT_COUNTERS_SEED.as_bytes(),
                bidder_key.as_ref(),
            ],
            ctx.program_id,
        );
        require!(
            ctx.accounts.agent_counters.key() == expected_counters,
            SableError::InvalidRecipientAccounts
        );

        let mut counters_data = ctx.accounts.agent_counters.try_borrow_mut_data()?;
        let mut counters = AgentCounters::try_deserialize(&mut &counters_data[..])
            .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;

        // Policy check: deposit is treated as an outbound transfer
        let updated_counters = validate_spend(
            &bidder_state.policy,
            &counters,
            now,
            deposit,
            &mint_key,
            &task.key(),
        )?;

        debit_bidder_agent_balance(&ctx.accounts.bidder_balance, bidder_key, mint_key, deposit)?;

        // Write back updated counters
        counters.spent_total = updated_counters.spent_total;
        counters.spent_today = updated_counters.spent_today;
        counters.current_day = updated_counters.current_day;
        counters.serialize(&mut &mut counters_data[..])?;
        drop(counters_data);
    }
    drop(bidder_data);

    // Credit deposit into task escrow
    task_escrow.amount = task_escrow
        .amount
        .checked_add(deposit)
        .ok_or(SableError::Overflow)?;

    // Increment task bid count
    task.bid_count = task
        .bid_count
        .checked_add(1)
        .ok_or(SableError::Overflow)?;

    // Initialize Bid PDA
    let bid = &mut ctx.accounts.bid;
    bid.version = 1;
    bid.bump = ctx.bumps.bid;
    bid.task = task.key();
    bid.bidder = bidder_key;
    bid.bidder_kind = bidder_kind;
    bid.commit_hash = commit_hash;
    bid.deposit = deposit;
    bid.revealed_amount = 0;
    bid.revealed = false;
    bid.submitted_at = now;

    emit!(BidCommitted {
        task: task.key(),
        bidder: bidder_key,
        deposit,
    });

    Ok(())
}

/// Debit a UserBalance by `amount`. Validates PDA and mint.
fn debit_bidder_user_balance(
    balance_acc_info: &AccountInfo,
    expected_owner: Pubkey,
    expected_mint: Pubkey,
    amount: u64,
) -> Result<()> {
    let balance_data = balance_acc_info.try_borrow_data()?;
    let balance = UserBalance::try_deserialize(&mut &balance_data[..])
        .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;
    require!(balance.owner == expected_owner, SableError::InvalidRecipientAccounts);
    require!(balance.mint == expected_mint, SableError::InvalidMint);
    require!(balance.amount >= amount, SableError::InsufficientBalance);
    drop(balance_data);

    let mut data = balance_acc_info.try_borrow_mut_data()?;
    // UserBalance: amount at offset 73, version at offset 81
    let current_amount = u64::from_le_bytes([
        data[73], data[74], data[75], data[76],
        data[77], data[78], data[79], data[80],
    ]);
    let new_amount = current_amount.checked_sub(amount).ok_or(SableError::Underflow)?;
    data[73..81].copy_from_slice(&new_amount.to_le_bytes());

    let current_version = u64::from_le_bytes([
        data[81], data[82], data[83], data[84],
        data[85], data[86], data[87], data[88],
    ]);
    let new_version = current_version.checked_add(1).ok_or(SableError::Overflow)?;
    data[81..89].copy_from_slice(&new_version.to_le_bytes());

    Ok(())
}

/// Debit an AgentBalance by `amount`. Validates PDA and mint.
fn debit_bidder_agent_balance(
    balance_acc_info: &AccountInfo,
    expected_agent: Pubkey,
    expected_mint: Pubkey,
    amount: u64,
) -> Result<()> {
    let balance_data = balance_acc_info.try_borrow_data()?;
    let balance = AgentBalance::try_deserialize(&mut &balance_data[..])
        .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;
    require!(balance.agent == expected_agent, SableError::InvalidRecipientAccounts);
    require!(balance.mint == expected_mint, SableError::InvalidMint);
    require!(balance.amount >= amount, SableError::InsufficientAgentBalance);
    drop(balance_data);

    let mut data = balance_acc_info.try_borrow_mut_data()?;
    // AgentBalance: amount at offset 72, version at offset 80
    let current_amount = u64::from_le_bytes([
        data[72], data[73], data[74], data[75],
        data[76], data[77], data[78], data[79],
    ]);
    let new_amount = current_amount.checked_sub(amount).ok_or(SableError::Underflow)?;
    data[72..80].copy_from_slice(&new_amount.to_le_bytes());

    let current_version = u64::from_le_bytes([
        data[80], data[81], data[82], data[83],
        data[84], data[85], data[86], data[87],
    ]);
    let new_version = current_version.checked_add(1).ok_or(SableError::Overflow)?;
    data[80..88].copy_from_slice(&new_version.to_le_bytes());

    Ok(())
}
