use anchor_lang::prelude::*;
use crate::error::SableError;
use crate::events::AuctionSettled;
use crate::state::{Bid, BidderKind, Task, TaskEscrow, TaskState};

#[derive(Accounts)]
pub struct SettleAuction<'info> {
    pub caller: Signer<'info>,

    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [
            crate::instructions::auction::create_task::TASK_ESCROW_SEED.as_bytes(),
            task.key().as_ref(),
        ],
        bump = task_escrow.bump,
        has_one = task,
    )]
    pub task_escrow: Account<'info, TaskEscrow>,

    /// CHECK: Poster balance (UserBalance or AgentBalance), validated in instruction
    #[account(mut)]
    pub poster_balance: AccountInfo<'info>,
}

/// Settle the auction after the reveal deadline.
///
/// `remaining_accounts` must be interleaved:
///   [i*2 + 0]: Bid PDA for bidder i
///   [i*2 + 1]: bidder balance PDA for bidder i
///
/// Callable by anyone (crank-friendly).
pub fn settle_auction(ctx: Context<SettleAuction>) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    let task = &mut ctx.accounts.task;
    let task_escrow = &mut ctx.accounts.task_escrow;

    // State and deadline checks
    require!(task.state == TaskState::Open, SableError::TaskWrongState);
    require!(now > task.bid_reveal_deadline, SableError::TaskDeadlineInvalid);

    // Validate poster balance PDA
    let poster_balance_key = ctx.accounts.poster_balance.key();
    let expected_poster_balance = if task.poster_kind == crate::state::PosterKind::User {
        Pubkey::find_program_address(
            &[
                crate::USER_BALANCE_SEED.as_bytes(),
                task.poster.as_ref(),
                task.mint.as_ref(),
            ],
            ctx.program_id,
        )
        .0
    } else {
        Pubkey::find_program_address(
            &[
                crate::AGENT_BALANCE_SEED.as_bytes(),
                task.poster.as_ref(),
                task.mint.as_ref(),
            ],
            ctx.program_id,
        )
        .0
    };
    require!(
        poster_balance_key == expected_poster_balance,
        SableError::InvalidRecipientAccounts
    );

    let remaining = ctx.remaining_accounts;
    let bid_count = task.bid_count as usize;

    require!(
        remaining.len() == bid_count * 2,
        SableError::InvalidRecipientAccounts
    );

    // Scan all bids: validate PDAs, track deposits, find winner
    let mut total_deposits: u64 = 0;
    let mut bids: Vec<(Bid, &AccountInfo)> = Vec::with_capacity(bid_count);

    for i in 0..bid_count {
        let bid_acc_info = &remaining[i * 2];
        let balance_acc_info = &remaining[i * 2 + 1];

        // Validate Bid PDA
        let (expected_bid, _) = Pubkey::find_program_address(
            &[
                crate::instructions::auction::commit_bid::BID_SEED.as_bytes(),
                task.key().as_ref(),
                bid_acc_info.key().as_ref(),
            ],
            ctx.program_id,
        );
        require!(
            bid_acc_info.key() == expected_bid,
            SableError::InvalidRecipientAccounts
        );

        let bid = Bid::try_deserialize(&mut &bid_acc_info.try_borrow_data()?[..])
            .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;
        require!(bid.task == task.key(), SableError::InvalidRecipientAccounts);

        // Validate bidder balance PDA
        let expected_balance = if bid.bidder_kind == BidderKind::User {
            Pubkey::find_program_address(
                &[
                    crate::USER_BALANCE_SEED.as_bytes(),
                    bid.bidder.as_ref(),
                    task.mint.as_ref(),
                ],
                ctx.program_id,
            )
            .0
        } else {
            Pubkey::find_program_address(
                &[
                    crate::AGENT_BALANCE_SEED.as_bytes(),
                    bid.bidder.as_ref(),
                    task.mint.as_ref(),
                ],
                ctx.program_id,
            )
            .0
        };
        require!(
            balance_acc_info.key() == expected_balance,
            SableError::InvalidRecipientAccounts
        );

        total_deposits = total_deposits
            .checked_add(bid.deposit)
            .ok_or(SableError::Overflow)?;

        bids.push((bid, balance_acc_info));
    }

    // Escrow conservation check
    let expected_escrow = task
        .budget
        .checked_add(total_deposits)
        .ok_or(SableError::Overflow)?;
    debug_assert!(
        task_escrow.amount == expected_escrow,
        "Escrow conservation violated: escrow={} expected={}",
        task_escrow.amount,
        expected_escrow
    );

    // Find winner with deterministic tie-breaking
    let mut winner_index: Option<usize> = None;
    for (i, (bid, _)) in bids.iter().enumerate() {
        if !bid.revealed {
            continue;
        }
        match winner_index {
            None => winner_index = Some(i),
            Some(w) => {
                let current = &bids[w].0;
                if bid.revealed_amount < current.revealed_amount
                    || (bid.revealed_amount == current.revealed_amount
                        && bid.submitted_at < current.submitted_at)
                    || (bid.revealed_amount == current.revealed_amount
                        && bid.submitted_at == current.submitted_at
                        && bid.bidder < current.bidder)
                {
                    winner_index = Some(i);
                }
            }
        }
    }

    let mut forfeit_count: u32 = 0;

    if let Some(w_idx) = winner_index {
        let winner = &bids[w_idx];
        let winning_amount = winner.0.revealed_amount;

        // Winner payout = winning_amount + own deposit
        let winner_payout = winning_amount
            .checked_add(winner.0.deposit)
            .ok_or(SableError::Overflow)?;
        credit_balance(winner.1, winner.0.bidder_kind, winner_payout)?;

        // Non-winners
        for (i, (bid, balance_acc)) in bids.iter().enumerate() {
            if i == w_idx {
                continue;
            }
            if bid.revealed {
                // Revealed non-winner: deposit returned
                credit_balance(balance_acc, bid.bidder_kind, bid.deposit)?;
            } else {
                // Unrevealed: deposit forfeited to poster
                forfeit_count = forfeit_count.checked_add(1).ok_or(SableError::Overflow)?;
            }
        }

        // Poster residual = (budget - winning_amount) + sum(unrevealed_deposits)
        let unrevealed_sum: u64 = bids
            .iter()
            .filter(|(bid, _)| !bid.revealed)
            .map(|(bid, _)| bid.deposit)
            .sum();
        let residual = task
            .budget
            .checked_sub(winning_amount)
            .ok_or(SableError::Underflow)?
            .checked_add(unrevealed_sum)
            .ok_or(SableError::Overflow)?;

        credit_poster_balance(
            &ctx.accounts.poster_balance,
            task.poster_kind,
            residual,
        )?;

        task.winning_bidder = winner.0.bidder;
        task.winning_bid = winning_amount;
    } else {
        // Zero revealed bids: refund full escrow to poster
        credit_poster_balance(
            &ctx.accounts.poster_balance,
            task.poster_kind,
            task_escrow.amount,
        )?;

        task.winning_bidder = Pubkey::default();
        task.winning_bid = 0;

        forfeit_count = bids.len() as u32;
    }

    // Zero out escrow
    task_escrow.amount = 0;

    // Mark settled
    task.state = TaskState::Settled;

    emit!(AuctionSettled {
        task: task.key(),
        winner: task.winning_bidder,
        amount: task.winning_bid,
        participants: task.bid_count,
        forfeit_count,
    });

    Ok(())
}

/// Credit a bidder balance (UserBalance or AgentBalance) by `amount`.
fn credit_balance(balance_acc: &AccountInfo, kind: BidderKind, amount: u64) -> Result<()> {
    let mut data = balance_acc.try_borrow_mut_data()?;

    if kind == BidderKind::User {
        // UserBalance: amount at offset 73, version at offset 81
        let current_amount = u64::from_le_bytes([
            data[73], data[74], data[75], data[76],
            data[77], data[78], data[79], data[80],
        ]);
        let new_amount = current_amount
            .checked_add(amount)
            .ok_or(SableError::Overflow)?;
        data[73..81].copy_from_slice(&new_amount.to_le_bytes());

        let current_version = u64::from_le_bytes([
            data[81], data[82], data[83], data[84],
            data[85], data[86], data[87], data[88],
        ]);
        let new_version = current_version
            .checked_add(1)
            .ok_or(SableError::Overflow)?;
        data[81..89].copy_from_slice(&new_version.to_le_bytes());
    } else {
        // AgentBalance: amount at offset 72, version at offset 80
        let current_amount = u64::from_le_bytes([
            data[72], data[73], data[74], data[75],
            data[76], data[77], data[78], data[79],
        ]);
        let new_amount = current_amount
            .checked_add(amount)
            .ok_or(SableError::Overflow)?;
        data[72..80].copy_from_slice(&new_amount.to_le_bytes());

        let current_version = u64::from_le_bytes([
            data[80], data[81], data[82], data[83],
            data[84], data[85], data[86], data[87],
        ]);
        let new_version = current_version
            .checked_add(1)
            .ok_or(SableError::Overflow)?;
        data[80..88].copy_from_slice(&new_version.to_le_bytes());
    }

    Ok(())
}

/// Credit the poster balance by `amount`. Validates account type via poster_kind.
fn credit_poster_balance(
    balance_acc: &AccountInfo,
    poster_kind: crate::state::PosterKind,
    amount: u64,
) -> Result<()> {
    let mut data = balance_acc.try_borrow_mut_data()?;

    if poster_kind == crate::state::PosterKind::User {
        // UserBalance: amount at offset 73, version at offset 81
        let current_amount = u64::from_le_bytes([
            data[73], data[74], data[75], data[76],
            data[77], data[78], data[79], data[80],
        ]);
        let new_amount = current_amount
            .checked_add(amount)
            .ok_or(SableError::Overflow)?;
        data[73..81].copy_from_slice(&new_amount.to_le_bytes());

        let current_version = u64::from_le_bytes([
            data[81], data[82], data[83], data[84],
            data[85], data[86], data[87], data[88],
        ]);
        let new_version = current_version
            .checked_add(1)
            .ok_or(SableError::Overflow)?;
        data[81..89].copy_from_slice(&new_version.to_le_bytes());
    } else {
        // AgentBalance: amount at offset 72, version at offset 80
        let current_amount = u64::from_le_bytes([
            data[72], data[73], data[74], data[75],
            data[76], data[77], data[78], data[79],
        ]);
        let new_amount = current_amount
            .checked_add(amount)
            .ok_or(SableError::Overflow)?;
        data[72..80].copy_from_slice(&new_amount.to_le_bytes());

        let current_version = u64::from_le_bytes([
            data[80], data[81], data[82], data[83],
            data[84], data[85], data[86], data[87],
        ]);
        let new_version = current_version
            .checked_add(1)
            .ok_or(SableError::Overflow)?;
        data[80..88].copy_from_slice(&new_version.to_le_bytes());
    }

    Ok(())
}
