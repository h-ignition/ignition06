import {
  CANDY_MACHINE_PROGRAM_ID,
  CONFIG_ARRAY_START,
  CONFIG_LINE_SIZE,
} from './constants';
import * as anchor from '@project-serum/anchor';

export async function createConfigAccount(
  anchorProgram,
  configData,
  payerWallet,
  configAccount,
) {
  const size =
    CONFIG_ARRAY_START +
    4 +
    configData.maxNumberOfLines.toNumber() * CONFIG_LINE_SIZE +
    4 +
    Math.ceil(configData.maxNumberOfLines.toNumber() / 8);

  return anchor.web3.SystemProgram.createAccount({
    fromPubkey: payerWallet,
    newAccountPubkey: configAccount,
    space: size,
    lamports:
      await anchorProgram.provider.connection.getMinimumBalanceForRentExemption(
        size,
      ),
    programId: CANDY_MACHINE_PROGRAM_ID,
  });
}
