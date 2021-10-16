import { Connection, PublicKey } from "@solana/web3.js";
import { Provider, web3 } from "@project-serum/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
const opts = {
  preflightCommitment: "processed",
};
export default async function getProvider() {
  const wallet = useWallet();
  const network = "devnet";
  const connection = new Connection(network, opts.preflightCommitment);
  const provider = new Provider(connection, wallet, opts.preflightCommitment);
  return provider;
}
