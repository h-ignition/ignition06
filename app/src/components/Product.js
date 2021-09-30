//this needs to be Product(name) or Product (hash)
import idl2 from "../idl2.json";
import { Program, web3, BN } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
const programID = new PublicKey(idl2.metadata.address);
export default async function Product(props) {
  const sellerAccount = null;
  const provider = props.provider;
  //this needs to be as props.account
  const projectAccount = null;
  const program = new Program(idl2, programID, provider);
  const tx = await program.rpc.buy(new BN(10), {
    accounts: {
      project: projectAccount.publicKey,
      buyer: provider.wallet.publicKey,
      seller: sellerAccount.publicKey,
      systemProgram: web3.SystemProgram.programId,
    },
    signers: [],
  });
  return (
    <div>
      <button
        onClick={() => {
          tx();
        }}
      ></button>
    </div>
  );
}
