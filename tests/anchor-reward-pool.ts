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
  const user2 = anchor.web3.Keypair.generate();

  // Create our pool creators keypair
  const poolCreator = anchor.web3.Keypair.generate();

  // Create our payers keypair
  const payer = anchor.web3.Keypair.generate();

  // Create our mint authority keypair
  const mintAuthority = anchor.web3.Keypair.generate();

  // Create our pool keypair
  const pool1Keypair = anchor.web3.Keypair.generate();

  // Declare our pool signer
  let pool1Signer;
  let pool1SignerNonce;

  // Declare our pool vaults
  let pool1StakeVault;
  let pool1RewardVault;

  // Declare the mint for our Reward Token
  let mintRewardToken;

  // Declare the mint for out Staking Token
  let mintStakingToken;

  // Declare our ATA's
  let user1StakingTokenAccount;
  let user1RewardTokenAccount;

  let user2StakingTokenAccount;
  let user2RewardTokenAccount;

  let poolCreatorRewardTokenAccount;

  // Declare our user's User Account
  let user1UserAccountAddress;
  let user1UserAccountNonce;

  let user2UserAccountAddress;
  let user2UserAccountNonce;

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
      await provider.connection.requestAirdrop(poolCreator.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    
    // Create our RewardToken mint
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
    poolCreatorRewardTokenAccount = await mintRewardToken.createAssociatedTokenAccount(poolCreator.publicKey);

    user1StakingTokenAccount = await mintStakingToken.createAssociatedTokenAccount(user1.publicKey);
    user1RewardTokenAccount = await mintRewardToken.createAssociatedTokenAccount(user1.publicKey);

    user2StakingTokenAccount = await mintStakingToken.createAssociatedTokenAccount(user2.publicKey);
    user2RewardTokenAccount = await mintRewardToken.createAssociatedTokenAccount(user2.publicKey);

    // Mint Staking Tokens to our users
    const AMOUNT_OF_STAKING_TOKENS_TO_MINT = 500 * (10 ** DECIMALS);
    await mintStakingToken.mintTo(user1StakingTokenAccount, mintAuthority, [], AMOUNT_OF_STAKING_TOKENS_TO_MINT);
    await mintStakingToken.mintTo(user2StakingTokenAccount, mintAuthority, [], AMOUNT_OF_STAKING_TOKENS_TO_MINT);

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
    [pool1Signer, pool1SignerNonce] = await anchor.web3.PublicKey.findProgramAddress(
      [pool1Keypair.publicKey.toBuffer()],
      program.programId,
    );

    pool1StakeVault = await mintStakingToken.createAccount(pool1Signer);
    pool1RewardVault = await mintRewardToken.createAccount(pool1Signer);


    let poolCreatorBalanceBefore = await provider.connection.getBalance(poolCreator.publicKey);

    await provider.connection.confirmTransaction(
      await program.rpc.initializePool(
        pool1SignerNonce,
        new anchor.BN(1),
        {
          accounts: {
            authority: poolCreator.publicKey,
            stakingMint: mintStakingToken.publicKey,
            stakingVault: pool1StakeVault,
            rewardMint: mintRewardToken.publicKey,
            rewardVault: pool1RewardVault,
            poolSigner: pool1Signer,
            pool: pool1Keypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          signers: [pool1Keypair, poolCreator]
        }
      ),
      "confirmed"
    );

    await printPoolAccountData(pool1Keypair.publicKey);

    let poolCreatorBalanceAfter = await provider.connection.getBalance(poolCreator.publicKey);
    console.log("Pool Account Creation Cost: ", (poolCreatorBalanceBefore - poolCreatorBalanceAfter) / anchor.web3.LAMPORTS_PER_SOL);

  });

  it('Creates a User Account for User1', async () => {
    [user1UserAccountAddress, user1UserAccountNonce] = await anchor.web3.PublicKey.findProgramAddress(
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

  it('User1 Stakes 200 tokens to Pool1', async () => {
    await provider.connection.confirmTransaction(
      await program.rpc.stake(
        new anchor.BN(200 * (10 ** DECIMALS)),
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            user: user1UserAccountAddress,
            owner: user1.publicKey,
            stakeFromAccount: user1StakingTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user1]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user1UserAccountAddress);
    await printPoolAccountData(pool1Keypair.publicKey);
  });

  it('Funds a pool', async () => {
    await provider.connection.confirmTransaction(
      await program.rpc.fund(
        new anchor.BN(1000 * (10 ** DECIMALS)),
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            rewardVault: pool1RewardVault,
            funder: poolCreator.publicKey,
            from: poolCreatorRewardTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [poolCreator]
        }
      ),
      "confirmed"
    );

    await printPoolAccountData(pool1Keypair.publicKey);
  });

  it('User1 Claims Rewards', async () => {
    await wait(10);
    
    await provider.connection.confirmTransaction(
      await program.rpc.claimReward(
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            rewardVault: pool1RewardVault,
            user: user1UserAccountAddress,
            owner: user1.publicKey,
            toRewardAccount: user1RewardTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user1]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user1UserAccountAddress);
    await printPoolAccountData(pool1Keypair.publicKey);

    let userRewardTokens = (await mintRewardToken.getAccountInfo(user1RewardTokenAccount)).amount;
    console.log("User Reward Tokens: ", userRewardTokens.toNumber() / (10 ** DECIMALS));
  });

  it('Creates a User Account for User2', async () => {
    [user2UserAccountAddress, user2UserAccountNonce] = await anchor.web3.PublicKey.findProgramAddress(
      [user2.publicKey.toBuffer(), pool1Keypair.publicKey.toBuffer()],
      program.programId
    )

    await provider.connection.confirmTransaction(
      await program.rpc.createUser(
        user2UserAccountNonce,
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            user: user2UserAccountAddress,
            owner: user2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          signers: [user2]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user2UserAccountAddress);

  });

  it('User2 Stakes 200 tokens to Pool1', async () => {
    await provider.connection.confirmTransaction(
      await program.rpc.stake(
        new anchor.BN(200 * (10 ** DECIMALS)),
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            user: user2UserAccountAddress,
            owner: user2.publicKey,
            stakeFromAccount: user2StakingTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user2]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user2UserAccountAddress);
    await printPoolAccountData(pool1Keypair.publicKey);
  });

  it('Funds a pool', async () => {
    await provider.connection.confirmTransaction(
      await program.rpc.fund(
        new anchor.BN(1000 * (10 ** DECIMALS)),
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            rewardVault: pool1RewardVault,
            funder: poolCreator.publicKey,
            from: poolCreatorRewardTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [poolCreator]
        }
      ),
      "confirmed"
    );

    await printPoolAccountData(pool1Keypair.publicKey);
  });

  it('User2 Claims Rewards', async () => {
    await wait(10);
    
    await provider.connection.confirmTransaction(
      await program.rpc.claimReward(
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            rewardVault: pool1RewardVault,
            user: user2UserAccountAddress,
            owner: user2.publicKey,
            toRewardAccount: user2RewardTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user2]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user2UserAccountAddress);
    await printPoolAccountData(pool1Keypair.publicKey);

    let userRewardTokens = (await mintRewardToken.getAccountInfo(user2RewardTokenAccount)).amount;
    console.log("User Reward Tokens: ", userRewardTokens.toNumber() / (10 ** DECIMALS));
  });

  it('User1 Claims More Rewards', async () => {
    
    await provider.connection.confirmTransaction(
      await program.rpc.claimReward(
        {
          accounts: {
            pool: pool1Keypair.publicKey,
            stakingVault: pool1StakeVault,
            rewardVault: pool1RewardVault,
            user: user1UserAccountAddress,
            owner: user1.publicKey,
            toRewardAccount: user1RewardTokenAccount,
            poolSigner: pool1Signer,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user1]
        }
      ),
      "confirmed"
    );

    await printUserAccountData(user1UserAccountAddress);
    await printPoolAccountData(pool1Keypair.publicKey);

    let userRewardTokens = (await mintRewardToken.getAccountInfo(user1RewardTokenAccount)).amount;
    console.log("User Reward Tokens: ", userRewardTokens.toNumber() / (10 ** DECIMALS));
  });


  // Utility Functions
  async function printUserAccountData(userAccountAddress) {
    let userAccount = await program.account.user.fetch(userAccountAddress);
    let poolPubkey = userAccount.pool.toString();
    let owner = userAccount.owner.toString();
    //let rewardPerTokenComplete = userAccount.rewardPerTokenComplete.toString();
    //let rewardPerTokenPending = userAccount.rewardPerTokenPending.toNumber();
    let balanceStaked = userAccount.balanceStaked.toNumber();

    console.log("------ User Account Data ------");
    console.log("Pool Pubkey: ", poolPubkey);
    console.log("owner: ", owner);
    //console.log("Reward Per Token Complete: ", rewardPerTokenComplete);
    //console.log("Reward Per Token Pending: ", rewardPerTokenPending);
    console.log("Balance Staked: ", balanceStaked / (10 ** DECIMALS));
  }

  async function printPoolAccountData(poolAccountAddress) {
    let poolAccount = await program.account.pool.fetch(poolAccountAddress);
    let stakedAmount = (await mintStakingToken.getAccountInfo(poolAccount.stakingVault)).amount.toNumber();
    let rewardAmount = (await mintRewardToken.getAccountInfo(poolAccount.rewardVault)).amount.toNumber();
    //let rewardDuration = poolAccount.rewardDuration.toNumber();
    //let rewardDurationEnd = poolAccount.rewardDurationEnd.toNumber();
    //let lastUpdateTime = poolAccount.lastUpdateTime.toNumber();
    //let rewardRate = poolAccount.rewardRate.toNumber();
    //let rewardPerTokenStored = poolAccount.rewardPerTokenStored.toString();
    let usersStaked = poolAccount.userStakeCount;

    console.log("----- Pool Account Data -----")
    //console.log("Pool Pubkey: ", poolAccountAddress.toString());
    console.log("Staked Amount: ", stakedAmount / (10 ** DECIMALS));
    console.log("Reward Amount: ", rewardAmount / (10 ** DECIMALS));
    //console.log("Reward Duration: ", rewardDuration);
    //console.log("Reward Duration End: ", rewardDurationEnd);
    //console.log("Last Update Time: ", lastUpdateTime);
    //console.log("Reward Rate: ", rewardRate / (10 ** DECIMALS));
    //console.log("Reward Per Token Stored: ", rewardPerTokenStored);
    console.log("Users Staked: ", usersStaked);

  }

  async function wait(seconds) {
    while(seconds > 0) {
      console.log("countdown " + seconds--);
      await new Promise(a=>setTimeout(a, 1000))
    }
    console.log("Wait Over");
  }

});
