import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { AnchorRewardPool } from '../target/types/anchor_reward_pool';

describe('anchor-reward-pool', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.AnchorRewardPool as Program<AnchorRewardPool>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
