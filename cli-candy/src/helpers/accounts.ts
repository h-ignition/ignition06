import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import {
  CANDY_MACHINE,
  CANDY_MACHINE_PROGRAM_ID,
} from './constants';
import * as anchor from '@project-serum/anchor';
import fs from 'fs';
import BN from 'bn.js';
import { createConfigAccount } from './instructions';
import { web3 } from '@project-serum/anchor';
import log from 'loglevel';

export const createConfig = async function (
  anchorProgram: anchor.Program,
  payerWallet: Keypair,
  configData: {
    maxNumberOfLines: BN;
    symbol: string;
    sellerFeeBasisPoints: number;
    isMutable: boolean;
    maxSupply: BN;
    retainAuthority: boolean;
    creators: {
      address: PublicKey;
      verified: boolean;
      share: number;
    }[];
  },
) {
  const configAccount = Keypair.generate();
  const uuid = uuidFromConfigPubkey(configAccount.publicKey);

  return {
    config: configAccount.publicKey,
    uuid,
    txId: await anchorProgram.rpc.initializeConfig(
      {
        uuid,
        ...configData,
      },
      {
        accounts: {
          config: configAccount.publicKey,
          authority: payerWallet.publicKey,
          payer: payerWallet.publicKey,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [payerWallet, configAccount],
        instructions: [
          await createConfigAccount(
            anchorProgram,
            configData,
            payerWallet.publicKey,
            configAccount.publicKey,
          ),
        ],
      },
    ),
  };
};

export function uuidFromConfigPubkey(configAccount: PublicKey) {
  return configAccount.toBase58().slice(0, 6);
}


export const getCandyMachineAddress = async (
  config: anchor.web3.PublicKey,
  uuid: string,
): Promise<[PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(CANDY_MACHINE), config.toBuffer(), Buffer.from(uuid)],
    CANDY_MACHINE_PROGRAM_ID,
  );
};


export function loadWalletKey(keypair): Keypair {
  if (!keypair || keypair == '') {
    throw new Error('Keypair is required!');
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
  );
  log.info(`wallet public key: ${loaded.publicKey}`);
  return loaded;
}

export async function loadCandyProgram(walletKeyPair: Keypair, env: string) {
  
  let solConnection : web3.Connection;
  if(env == "localnet") {
    solConnection = new web3.Connection("http://127.0.0.1:8899", "confirmed");
  } else {
    // @ts-ignore
    solConnection = new web3.Connection(web3.clusterApiUrl(env));
  }

  const walletWrapper = new anchor.Wallet(walletKeyPair);
  const provider = new anchor.Provider(solConnection, walletWrapper, {
    preflightCommitment: 'recent',
  });

  //const idl = await anchor.Program.fetchIdl(CANDY_MACHINE_PROGRAM_ID, provider);
  const idl = JSON.parse(fs.readFileSync('./target/idl/candy_machine.json', 'utf8'));

  const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM_ID, provider);
  log.info('program id from anchor', program.programId.toBase58());
  return program;
}

