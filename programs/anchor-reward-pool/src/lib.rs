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
