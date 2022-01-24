use anchor_lang::prelude::*;

declare_id!("7xpwc6uLVzToRuPwser2aD3cDYMKtsjFWMe4yTUMSMYp");

#[program]
pub mod anchor_reward_pool {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[account]
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
pub struct User {
    // The pool this user belongs to
    pool: Pubkey,
    // The owner of this account
    owner: Pubkey,
    // The amount of reward tokens claimed
    reward_per_token_complete: u128,
    // The amount of reward tokens pending claim
    reward_per_token_pending: u128,
    // The amount staked
    balance_staked: u64,
    // Signer nonce
    nonce: u8,
}
