use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{self, Mint, TokenAccount, Token};

use std::convert::TryInto;

declare_id!("7xpwc6uLVzToRuPwser2aD3cDYMKtsjFWMe4yTUMSMYp");

const PRECISION: u128 = u64::MAX as u128;

pub fn update_rewards(
    pool: &mut Account<Pool>,
    user: Option<&mut Account<User>>,
    total_staked: u64,
) -> ProgramResult {
    let last_time_reward_applicable = last_time_reward_applicable(pool.reward_duration_end);

    let reward = calc_reward_per_token(pool, total_staked, last_time_reward_applicable);

    pool.reward_per_token_stored = reward;

    pool.last_update_time = last_time_reward_applicable;

    if let Some(user) = user {
        let earned_amount = calc_user_earned_amount(pool, user);

        user.reward_per_token_pending = earned_amount;
        user.reward_per_token_complete = pool.reward_per_token_stored;
    }

    Ok(())
}

fn last_time_reward_applicable(reward_duration_end: u64) -> u64 {
    let c = anchor_lang::solana_program::clock::Clock::get().unwrap();
    std::cmp::min(c.unix_timestamp.try_into().unwrap(), reward_duration_end)
}

fn calc_reward_per_token(
    pool: &Account<Pool>, 
    total_staked: u64, 
    last_time_reward_applicable: u64
) -> u128 {
    if total_staked == 0 {
        return pool.reward_per_token_stored;
    }

    pool
        .reward_per_token_stored
        .checked_add(
            (last_time_reward_applicable as u128)
                .checked_sub(pool.last_update_time as u128)
                .unwrap()
                .checked_mul(pool.reward_rate as u128)
                .unwrap()
                .checked_mul(PRECISION)
                .unwrap()
                .checked_div(total_staked as u128)
                .unwrap(),
        )
        .unwrap()
}

fn calc_user_earned_amount(
    pool: &Account<Pool>,
    user: &Account<User>,
) -> u64 {
    (user.balance_staked as u128)
        .checked_mul(
            (pool.reward_per_token_stored as u128)
                .checked_sub(user.reward_per_token_complete as u128)
                .unwrap(),
        )
        .unwrap()
        .checked_div(PRECISION)
        .unwrap()
        .checked_add(user.reward_per_token_pending as u128)
        .unwrap()
        .try_into()
        .unwrap()
}

#[program]
pub mod anchor_reward_pool {
    use super::*;
    pub fn initialize_pool(ctx: Context<InitializePool>, pool_nonce: u8, reward_duration: u64) -> ProgramResult {
        // Add a minimum reward_duration

        // Add some tokens to lockup to create this pool


        let pool = &mut ctx.accounts.pool;

        pool.authority = ctx.accounts.authority.key();
        pool.nonce = pool_nonce;
        pool.staking_mint = ctx.accounts.staking_mint.key();
        pool.staking_vault = ctx.accounts.staking_vault.key();
        pool.reward_mint = ctx.accounts.reward_mint.key();
        pool.reward_vault = ctx.accounts.reward_vault.key();
        pool.reward_duration = reward_duration;
        pool.reward_duration_end = 0;
        pool.last_update_time = 0;
        pool.reward_rate = 0;
        pool.reward_per_token_stored = 0;
        pool.user_stake_count = 0;

        Ok(())
    }

    pub fn create_user(ctx: Context<CreateUser>, nonce: u8) -> ProgramResult {
        let user = &mut ctx.accounts.user;

        user.pool = *ctx.accounts.pool.to_account_info().key;
        user.owner = *ctx.accounts.owner.key;
        user.reward_per_token_complete = 0;
        user.reward_per_token_pending = 0;
        user.balance_staked = 0;
        user.nonce = nonce;

        let pool = &mut ctx.accounts.pool;
        pool.user_stake_count = pool.user_stake_count.checked_add(1).unwrap();

        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> ProgramResult {
        if amount == 0 {
            return Err(ErrorCode::AmountMustBeGreaterThanZero.into());
        }

        let pool = &mut ctx.accounts.pool;

        let total_staked = ctx.accounts.staking_vault.amount;

        let user_opt = Some(&mut ctx.accounts.user);
        update_rewards(pool, user_opt, total_staked).unwrap();

        ctx.accounts.user.balance_staked = ctx.accounts.user.balance_staked.checked_add(amount).unwrap();

        // Transfer tokens in the stake vault.
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.stake_from_account.to_account_info(),
                to: ctx.accounts.staking_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi_context, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(pool_nonce: u8)]
pub struct InitializePool<'info> {
    // The authority is the creator of the Pool Account.
    // They are an authorized funder of the reward vault, and can as pause the pool.
    #[account(mut)]
    authority: Signer<'info>,
    staking_mint: Account<'info, Mint>,
    #[account(
        constraint = staking_vault.mint == staking_mint.key(),
        constraint = staking_vault.owner == pool_signer.key(),
        constraint = staking_vault.close_authority == COption::None,
    )]
    staking_vault: Account<'info, TokenAccount>,
    reward_mint: Account<'info, Mint>,
    #[account(
        constraint = reward_vault.mint == reward_mint.key(),
        constraint = reward_vault.owner == pool_signer.key(),
        constraint = reward_vault.close_authority == COption::None,
    )]
    reward_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [pool.to_account_info().key.as_ref()],
        bump = pool_nonce,
    )]
    pool_signer: SystemAccount<'info>,
    #[account(init, payer = authority)]
    pool: Account<'info, Pool>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct CreateUser<'info> {
    #[account(mut)]
    pool: Account<'info, Pool>,
    #[account(
        init,
        payer = owner,
        seeds = [owner.key.as_ref(), pool.to_account_info().key.as_ref()],
        bump = nonce)]
    user: Account<'info, User>,
    #[account(mut)]
    owner: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        mut,
        has_one = staking_vault,
    )]
    pool: Account<'info, Pool>,
    #[account(
        mut,
        constraint = staking_vault.owner == *pool_signer.key,
    )]
    staking_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = owner,
        has_one = pool,
        seeds = [owner.key.as_ref(), pool.to_account_info().key.as_ref()],
        bump = user.nonce,
    )]
    user: Account<'info, User>,
    owner: Signer<'info>,
    #[account(mut)]
    stake_from_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [pool.to_account_info().key.as_ref()],
        bump = pool.nonce,
    )]
    pool_signer: SystemAccount<'info>,
    token_program: Program<'info, Token>,
}


#[account]
#[derive(Default)]
pub struct Pool {
    // Priviledged account
    authority: Pubkey,
    // Nonce to derive the PDA owning the vaults
    nonce: u8,
    // Mint of the token that can be staked
    staking_mint: Pubkey,
    // Vault to store staked tokens
    staking_vault: Pubkey,
    // Mint of the reward token
    reward_mint: Pubkey,
    // Vault to store reward tokens
    reward_vault: Pubkey,
    // The period which rewards are linearly distributed
    reward_duration: u64,
    // The timestamp at which the current reward period ends
    reward_duration_end: u64,
    // The last time reward states were updated
    last_update_time: u64,
    // Rate of reward distribution
    reward_rate: u64,
    // Last calculated reward per pool token
    reward_per_token_stored: u128,
    // Users staked
    user_stake_count: u32,
}

#[account]
#[derive(Default)]
pub struct User {
    // The pool this user belongs to
    pool: Pubkey,
    // The owner of this account
    owner: Pubkey,
    // The amount of reward tokens claimed
    reward_per_token_complete: u128,
    // The amount of reward tokens pending claim
    reward_per_token_pending: u64,
    // The amount staked
    balance_staked: u64,
    // Signer nonce
    nonce: u8,
}

#[error]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero.")]
    AmountMustBeGreaterThanZero,
}
