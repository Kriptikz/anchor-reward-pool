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

  // Create our pool keypair
  const pool1Keypair = anchor.web3.Keypair.generate();

  // Declare the mint for our Reward Token
  let mintRewardToken;

  // Declare the mint for out Staking Token
  let mintStakingToken;

  // Declare our ATA's
  let user1StakingTokenAccount;
  let user1RewardTokenAccount;

  let poolCreatorRewardTokenAccount;

  it('Test Set Up!', async () => {
    // Airdrop 5 Sol to payer, mintAuthority, poolCreator, and user
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
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(poolCreator.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
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

    // Print our Public Keys 
    console.log("Pool1 Pubkey: ", pool1Keypair.publicKey.toString());
    console.log("User1 Pubkey: ", user1.publicKey.toString());

  });

  it('Creates a pool', async () => {

    // Find our pool signer PDA
    const [poolSigner, poolNonce] = await anchor.web3.PublicKey.findProgramAddress(
      [pool1Keypair.publicKey.toBuffer()],
      program.programId,
    );

    let stakingVault = await mintStakingToken.createAccount(poolSigner);
    let rewardVault = await mintRewardToken.createAccount(poolSigner);


    let poolCreatorBalanceBefore = await provider.connection.getBalance(poolCreator.publicKey);

    await provider.connection.confirmTransaction(
      await program.rpc.initializePool(
        poolNonce,
        new anchor.BN(1000),
        {
          accounts: {
            authority: poolCreator.publicKey,
            stakingMint: mintStakingToken.publicKey,
            stakingVault: stakingVault,
            rewardMint: mintRewardToken.publicKey,
            rewardVault: rewardVault,
            poolSigner: poolSigner,
            pool: pool1Keypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          signers: [pool1Keypair, poolCreator]
        }
      ),
      "confirmed"
    );

    let poolCreatorBalanceAfter = await provider.connection.getBalance(poolCreator.publicKey);
    console.log("Pool Account Creation Cost: ", (poolCreatorBalanceBefore - poolCreatorBalanceAfter) / anchor.web3.LAMPORTS_PER_SOL);

  });

  it('Creates a Staking Account for the User', async () => {
    const [user1UserAccountAddress, user1UserAccountNonce] = await anchor.web3.PublicKey.findProgramAddress(
      [user1.publicKey.toBuffer(), pool1Keypair.publicKey.toBuffer()],
      program.programId
    )

    await provider.connection.confirmTransaction(
      await program.rpc.createUser(
        user1UserAccountNonce,
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            user: user1UserAccountAddress,
            owner: user1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          signers: [user1]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user1UserAccountAddress);

  });

  // Utility Functions
  async function printUserAccountData(userAccountAddress) {
    let userAccount = await program.account.user.fetch(userAccountAddress);
    let poolPubkey = userAccount.pool.toString();
    let owner = userAccount.owner.toString();
    let rewardPerTokenComplete = userAccount.rewardPerTokenComplete.toNumber();
    let rewardPerTokenPending = userAccount.rewardPerTokenPending.toNumber();
    let balanceStaked = userAccount.balanceStaked.toNumber();

    console.log("------ User Account Data ------");
    console.log("Pool Pubkey: ", poolPubkey);
    console.log("owner: ", owner);
    console.log("Reward Per Token Complete: ", rewardPerTokenComplete);
    console.log("Reward Per Token Pending: ", rewardPerTokenPending);
    console.log("Balance Staked: ", balanceStaked);
  }

});
