import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { AnchorRewardPool } from '../target/types/anchor_reward_pool';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { assert } from 'chai';

describe('anchor-reward-pool', () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorRewardPool as Program<AnchorRewardPool>;

  // Decimals of our tokens
  const DECIMALS = 6;

  // Create our user keypair
  const user1 = anchor.web3.Keypair.generate();

  // Create our pool creators keypair
  const poolCreator = anchor.web3.Keypair.generate();

  // Create our payers keypair
  const payer = anchor.web3.Keypair.generate();

  // Create our mint authority keypair
  const mintAuthority = anchor.web3.Keypair.generate();

  // Declare the mint for our Reward Token
  let mintRewardToken;

  // Declare the mint for out Staking Token
  let mintStakingToken;

  // Declare our ATA's
  let user1StakingTokenAccount;
  let user1RewardTokenAccount;

  let poolCreatorRewardTokenAccount;

  it('Test Set Up!', async () => {
    // Airdrop 5 Sol to payer, mintAuthority, and user
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(mintAuthority.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    
    // Creat our RewardToken mint
    mintRewardToken = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      DECIMALS,
      TOKEN_PROGRAM_ID,
    );

    // Create our StakingToken mint
    mintStakingToken = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      DECIMALS,
      TOKEN_PROGRAM_ID,
    );

    // Create our users ATA's
    user1StakingTokenAccount = await mintStakingToken.createAssociatedTokenAccount(user1.publicKey);
    user1RewardTokenAccount = await mintRewardToken.createAssociatedTokenAccount(user1.publicKey);
    poolCreatorRewardTokenAccount = await mintRewardToken.createAssociatedTokenAccount(poolCreator.publicKey);

    // Mint Staking Tokens to our users
    const AMOUNT_OF_STAKING_TOKENS_TO_MINT = 500 * (10 ** DECIMALS);
    await mintStakingToken.mintTo(user1StakingTokenAccount, mintAuthority, [], AMOUNT_OF_STAKING_TOKENS_TO_MINT);


    // Verify Staking Token Amount in User's wallet
    const user1StakingTokenAccountAmount = (await mintStakingToken.getAccountInfo(user1StakingTokenAccount)).amount.toNumber();
    console.log("User 1 Staking Tokens in wallet: ", user1StakingTokenAccountAmount / (10 ** DECIMALS));
    assert.equal(user1StakingTokenAccountAmount, AMOUNT_OF_STAKING_TOKENS_TO_MINT);

    // Verify Reward Token Amount in User's wallet
    const user1RewardTokenAccountAmount = (await mintRewardToken.getAccountInfo(user1RewardTokenAccount)).amount.toNumber();
    console.log("User 1 Reward Tokens in wallet: ", user1RewardTokenAccountAmount / (10 ** DECIMALS));
    assert.equal(user1RewardTokenAccountAmount, 0);

    // Mint Reward Tokens to our poolCreator's wallet
    const AMOUNT_OF_REWARD_TOKENS_TO_MINT = 5000 * (10 ** DECIMALS);
    await mintRewardToken.mintTo(poolCreatorRewardTokenAccount, mintAuthority, [], AMOUNT_OF_REWARD_TOKENS_TO_MINT);

    // Verify Reward Token Amount in poolCreator's wallet
    const poolCreatorRewardTokenAccountAmount = (await mintRewardToken.getAccountInfo(poolCreatorRewardTokenAccount)).amount.toNumber();
    console.log("Pool Creators Reward Tokens in wallet: ", poolCreatorRewardTokenAccountAmount / (10 ** DECIMALS));
    assert.equal(poolCreatorRewardTokenAccountAmount, AMOUNT_OF_REWARD_TOKENS_TO_MINT);

  });
});
