
import{
  SystemProgram,
} from "@solana/web3.js"
import assert from "assert"
import * as anchor

 from "@project-serum/anchor";
import idl2 from "../idl2.json";
import idl from "../idl.json";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { web3 } from '@project-serum/anchor';
import {
  ensureBalance,
  getCandyMachine,
  getCandyProgram,
  getHarmoniaProgram,
  getMasterEditionAddress,
  getMetadataAddress,
  getOwnedTokenAccounts,
  getTokenWalletAddress,
  initializeCandyMachine,
  mintNft,
  TOKEN_METADATA_PROGRAM_ID,
  updateCandyMachine,
} from "../utils/tests/helper";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
const opts = {
    preflightCommitment: "processed"
  }
export default function Mint (){
    async function getProvider() {
        /* create the provider and return it to the caller */
        /* network set to local network for now */
        const network = "http://127.0.0.1:8899";
        const connection = new Connection(network, opts.preflightCommitment);
    
        const provider = new Provider(
          connection, wallet, opts.preflightCommitment,
        );
        return provider;
      }
    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const myWallet = provider.wallet["payer"] as web3.Keypair;

    const sellerAccount = anchor.web3.Keypair.generate();
    const projectAccount = anchor.web3.Keypair.generate();
    const buyerAccount = anchor.web3.Keypair.generate();

    const harmoniaProgram = getHarmoniaProgram(provider);
    const candyProgram = getCandyProgram(provider);
    const candyProgramId: web3.PublicKey = candyProgram.programId;

    const projectDescription = "The proposed project activity is to treat the manure and wastewater from swine farms of Muyuan Foods Co.,Ltd., in Nanyang City, Henan Province (hereafter refer to as Muyuan) which consists fourteen subsidiary swine farms.";
    const projectPicture = "https://live.staticflickr.com/4133/4841550483_72190f5368_b.jpg";


    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    let config: web3.Keypair = null;
    let candyMachineUuid: string = null;
    let machineState: any = null;

     async before () => {
        const harmoniaBalance = await ensureBalance(provider, provider.wallet.publicKey, 5);
        let sellerWallet = await ensureBalance(provider, sellerAccount.publicKey, 5);
        let buyerWallet = await ensureBalance(provider, buyerAccount.publicKey, 5);
    });


    it('Create a project + candymachine', async () => {

        await harmoniaProgram.rpc.create(new anchor.BN(500), new anchor.BN(2000), "AmazingSolarFarm", projectDescription, projectPicture, {
            accounts: {
                project: projectAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [projectAccount, sellerAccount],
        });

        // Fetch the newly created account from the cluster.
        const account = await harmoniaProgram.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.totalOffset.toNumber(), 500);

        // Create candy machine and set start date
        const res = await initializeCandyMachine(provider, candyProgram, sellerAccount, 10);
        config = res.config;
        candyMachineUuid = res.candyMachineUuid;

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        await updateCandyMachine(candyProgram, candyMachine, sellerAccount, null, 0);


    });

        // Fetch the project from the cluster.
        const account = await harmoniaProgram.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.availableOffset.toNumber(), (500 - 10));
        assert.equal(account.totalOffset.toNumber(), 500);
    });

    it('Buy and mint', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemedByLevel[0].eq(new anchor.BN(1)));

        const mint = anchor.web3.Keypair.generate();
        const token = await getTokenWalletAddress(buyerAccount.publicKey, mint.publicKey);
        const metadata = await getMetadataAddress(mint.publicKey);
        const masterEdition = await getMasterEditionAddress(mint.publicKey);

        const tx = await harmoniaProgram.rpc.buyAndMint(new anchor.BN(10), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                candyProgram: candyProgram.programId,

                config: config.publicKey,
                candyMachine: candyMachine,
                payer: buyerAccount.publicKey,
                wallet: sellerAccount.publicKey, // treasury
                mint: mint.publicKey,
                associatedToken: token,
                metadata: metadata,
                masterEdition: masterEdition,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            },
            signers: [mint, buyerAccount],
        });

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemedByLevel[0].eq(new anchor.BN(2)));

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 2);
        assert.ok((mint.publicKey.toBase58() == tokens[0].accountInfo.mint) || (mint.publicKey.toBase58() == tokens[1].accountInfo.mint));

    });
}

return <button onClick={()=>mint()}/>


}
