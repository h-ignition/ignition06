//this needs to be Product(name) or Product (hash)
import idl2 from "../idl2.json";
import { Program, web3 } from "@project-serum/anchor";
const programID = new PublicKey(idl2.metadata.address);
export default async function Product(props) {
  const provider = props.provider;
  const projectAccount = web3.Keypair.generate();
  const program = new Program(idl2, programID, provider);
  const tx = await program.rpc.buy(new anchor.BN(10), {
    accounts: {
      project: projectAccount.publicKey,
      buyer: provider.wallet.publicKey,
      seller: sellerAccount.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
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
