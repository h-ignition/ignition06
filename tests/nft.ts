import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { ensureBalance, getCandyMachine, getCandyProgram, getHarmoniaProgram, getMasterEditionAddress, getMetadataAddress, getOwnedTokenAccounts, getTokenWalletAddress, initializeCandyMachine, mintNft, TOKEN_METADATA_PROGRAM_ID, updateCandyMachine } from './helper';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
//import { program } from 'commander';
import { SystemProgram } from '@solana/web3.js'

function toSOL(lamport: number) {
    return lamport / web3.LAMPORTS_PER_SOL;
}


describe("nft-test-suite", () => {

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

    before('Print info', async () => {
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


    it('Buyer mint 1 directly', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const res = await mintNft(provider, candyProgram, candyMachine, config.publicKey, buyerAccount);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemedByLevel[0].eq(new anchor.BN(1)));
        assert.ok(machineState.data.itemsByLevel[0].itemsAvailable.eq(new anchor.BN(10)));
    });



    it('Buy 10 offsets directly', async () => {

        const tx = await harmoniaProgram.rpc.buy(new anchor.BN(10), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [buyerAccount],
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

});





describe("nft-multi-levels", () => {

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

    before('Print info', async () => {
        const harmoniaBalance = await ensureBalance(provider, provider.wallet.publicKey, 5);
        let sellerWallet = await ensureBalance(provider, sellerAccount.publicKey, 5);
        let buyerWallet = await ensureBalance(provider, buyerAccount.publicKey, 5);
    });


    it('Create a project + multi lvl candymachine', async () => {

        await harmoniaProgram.rpc.create(new anchor.BN(1000000), new anchor.BN(2000), "SolarFarm", projectDescription, projectPicture, {
            accounts: {
                project: projectAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [projectAccount, sellerAccount],
        });

        // Fetch the newly created account from the cluster.
        const account = await harmoniaProgram.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.totalOffset.toNumber(), 1000000);

        // Create candy machine and set start date
        // 2 items > 100
        // 5 items > 10
        // 10 items > 1
        const res = await initializeCandyMachine(provider, candyProgram, sellerAccount, [{
            itemsAvailable: new anchor.BN(2),
            price: new anchor.BN(1000)
        },
        {
            itemsAvailable: new anchor.BN(5),
            price: new anchor.BN(100)
        },
        {
            itemsAvailable: new anchor.BN(10),
            price: new anchor.BN(10)
        }]);
        config = res.config;
        candyMachineUuid = res.candyMachineUuid;

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        await updateCandyMachine(candyProgram, candyMachine, sellerAccount, null, 0);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemedByLevel[0].eq(new anchor.BN(0)));
        assert.ok(machineState.itemsRedeemedByLevel[1].eq(new anchor.BN(0)));
        assert.ok(machineState.itemsRedeemedByLevel[2].eq(new anchor.BN(0)));

        assert.ok(machineState.data.itemsByLevel[0].itemsAvailable.eq(new anchor.BN(2)));
        assert.ok(machineState.data.itemsByLevel[1].itemsAvailable.eq(new anchor.BN(5)));
        assert.ok(machineState.data.itemsByLevel[2].itemsAvailable.eq(new anchor.BN(10)));
    });


    async function buy(mint: web3.Keypair, offsets: number) {
        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const token = await getTokenWalletAddress(buyerAccount.publicKey, mint.publicKey);
        const metadata = await getMetadataAddress(mint.publicKey);
        const masterEdition = await getMasterEditionAddress(mint.publicKey);
        const tx = await harmoniaProgram.rpc.buyAndMint(new anchor.BN(offsets), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                candyProgram: candyProgram.programId,

                config: config.publicKey,
                candyMachine: candyMachine,
                payer: buyerAccount.publicKey,
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
        return tx;
    }


    it('Buy 500 offset get 1 rare nft', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const mint = anchor.web3.Keypair.generate();

        await buy(mint, 500);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 1);

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 1);
    });

    it('Buy 1000 offset get 1 epic nft', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const mint = anchor.web3.Keypair.generate();

        await buy(mint, 1000);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[0].toNumber(), 1);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 1);

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 2);
    });

    it('Buy 1500x2 offset get 1 epic, get 1 rare nft', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const mint = anchor.web3.Keypair.generate();

        await buy(mint, 1500);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[0].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 1);

        const mint2 = anchor.web3.Keypair.generate();
        await buy(mint2, 1500); // no more epic, will get a rare

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[0].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 2);

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 4);
    });

    it('Buy 1 offset get 0 nft', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const mint = anchor.web3.Keypair.generate();

        await buy(mint, 1);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[0].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[2].toNumber(), 0);

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 4);
    });

    it('Buy 10 offset get 1 common nft', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const mint = anchor.web3.Keypair.generate();

        await buy(mint, 10);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[0].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[2].toNumber(), 1);

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 5);
    });

    it('Buy 10x100 offset get 3 rare and 7 common nft', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        
        for (let i = 0; i < 10; i++) {
            const mint = anchor.web3.Keypair.generate();
            await buy(mint, 100);
        }

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.equal(machineState.itemsRedeemedByLevel[0].toNumber(), 2);
        assert.equal(machineState.itemsRedeemedByLevel[1].toNumber(), 2 + 3);
        assert.equal(machineState.itemsRedeemedByLevel[2].toNumber(), 1 + 7);

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 5 + 10);
    });

});
