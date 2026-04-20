use anchor_lang::prelude::*;
use solana_program::keccak::hashv;
use crate::error::SableError;
use crate::events::BidRevealed;
use crate::state::{AgentState, Bid, BidderKind, Task, TaskState, UserState};

#[derive(Accounts)]
pub struct RevealBid<'info> {
    #[account(mut)]
    pub bidder_owner: Signer<'info>,

    /// CHECK: Bidder account (UserState or AgentState), validated in instruction
    pub bidder: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [
            crate::instructions::auction::commit_bid::BID_SEED.as_bytes(),
            task.key().as_ref(),
            bidder.key().as_ref(),
        ],
        bump = bid.bump,
        has_one = task,
    )]
    pub bid: Account<'info, Bid>,

    pub task: Account<'info, Task>,
}

/// Reveal a sealed bid during the reveal window.
///
/// * `amount` — the bid amount.
/// * `nonce` — the random nonce used when committing.
pub fn reveal_bid(ctx: Context<RevealBid>, amount: u64, nonce: u64) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    let task = &ctx.accounts.task;
    let bid = &mut ctx.accounts.bid;

    // Task must be Open
    require!(task.state == TaskState::Open, SableError::TaskWrongState);

    // Must be within reveal window
    require!(now >= task.bid_commit_deadline, SableError::TaskDeadlineInvalid);
    require!(now <= task.bid_reveal_deadline, SableError::TaskDeadlineInvalid);

    // Bid must not already be revealed
    require!(!bid.revealed, SableError::TaskWrongState);

    // Amount must be ≤ budget
    require!(amount <= task.budget, SableError::InvalidAmount);

    // Verify bidder ownership
    let bidder_data = ctx.accounts.bidder.try_borrow_data()?;
    if bid.bidder_kind == BidderKind::User {
        let state = UserState::try_deserialize(&mut &bidder_data[..])
            .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;
        require!(
            state.owner == ctx.accounts.bidder_owner.key(),
            SableError::NotAuthorized
        );
    } else {
        let state = AgentState::try_deserialize(&mut &bidder_data[..])
            .map_err(|_| error!(SableError::InvalidRecipientAccounts))?;
        require!(
            state.owner == ctx.accounts.bidder_owner.key(),
            SableError::AgentNotAuthorized
        );
    }
    drop(bidder_data);

    // Recompute and verify commit hash
    let amount_bytes = amount.to_le_bytes();
    let nonce_bytes = nonce.to_le_bytes();
    let bidder_bytes = bid.bidder.to_bytes();

    let hash = hashv(&[&amount_bytes[..], &nonce_bytes[..], &bidder_bytes[..]]);
    require!(
        hash.to_bytes() == bid.commit_hash,
        SableError::InvalidReveal
    );

    // Record reveal
    bid.revealed = true;
    bid.revealed_amount = amount;

    emit!(BidRevealed {
        task: task.key(),
        bidder: bid.bidder,
        amount,
    });

    Ok(())
}
