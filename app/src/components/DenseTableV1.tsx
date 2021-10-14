import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useState } from "react";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  SystemProgram,
} from "@solana/web3.js";
import {
  BN,
  Program,
  Provider,
  web3,
  setProvider,
} from "@project-serum/anchor";
import idl2 from "../idl2.json";
import idl from "../idl.json";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
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
} from "../utils/helper";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const { Keypair } = web3;
const baseAccount = Keypair.generate();
const opts = {
  preflightCommitment: "processed",
};

///Caution with poor naming here!!!!!!!!!
const programID = new PublicKey(idl2.metadata.address);
const programID2 = new PublicKey(idl.metadata.address)

export default function DenseTable() {
  const wallet = useWallet();
  const [name, setName] = useState("");
  const [number, setNumber] = useState(0);
  const [price, setPrice] = useState(0);
  const [value, setValue] = useState("");
  async function getProvider() {
    const network = clusterApiUrl("devnet")
    //@ts-ignore
    const connection = new Connection(network, opts.preflightCommitment);
    //@ts-ignore
    const provider = new Provider(connection, wallet, opts.preflightCommitment);
    return provider;
  }

  const [projectList, setProjectList] = useState([
    {
      name: "p.account.name",
      number: "p.account.totalOffset.toString()",
      price: "p.account.offsetPrice.toString()",
      address: "p.publicKey",
      owner: "p.account.authority.toString()",
    },
  ]);

  React.useEffect(() => {
    async function getAllProjects() {
      const provider = await getProvider();
      //@ts-ignore
      const program = new Program(idl2, programID, provider);
      return await program.account.project.all();
    }
    // Create an scoped async function in the hook
    getAllProjects().then((projects) => {
      //@ts-ignore
      let pl = [];
      projects.forEach((p) => {
        // p.publicKey
        // p.account
        pl.push({
          name: p.account.name,
          number: p.account.availableOffset.toString(),
          price: p.account.offsetPrice.toString(),
          address: p.publicKey.toString(),
          owner: p.account.authority.toString(),
        });
        console.log(p.account.availableOffset.toString());
        console.log(p.account.authority.toString());
        console.log(p.publicKey.toString());
      });
      //@ts-ignore
      setProjectList(pl);
    });
  }, []);
  //@ts-ignore
  async function update(name, number, price) {
    if (!name) return;
    const provider = await getProvider();
    //@ts-ignore
    const projectAccount = web3.Keypair.generate();
    //@ts-ignore
    const program = new Program(idl2, programID, provider);
    const tx = await program.rpc.create(
      new BN(number),
      new BN(price),
      name,
      "this is kindness",
      "https://3gokwgc642v5nlkmfbvv6gmgzw7daw25rs3rgtn375zcoxy6xjhq.arweave.net/2ZyrGF7mq9atTChrXxmGzb4wW12MtxNNu_9yJ18euk8/?ext=png",
      {
        accounts: {
          project: projectAccount.publicKey,
          seller: provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        },

        signers: [projectAccount],
      }
    );
  }
  /*async function buy(amount) {
    const provider = await getProvider();
    const program = new Program(idl2, programID, provider);

    await program.rpc.buy(new BN(amount), {
      accounts: {
        project: projectList[4].address,
        buyer: provider.wallet.publicKey,
        seller: projectList[4].owner,
        systemProgram: web3.SystemProgram.programId,
      },

      signers: [],
    });
    var q = (amount * 3) / 100 + 1;
    alert(
      `thanks for your purchase, an nft lvl ${q} will be added to your Solana wallet`
    );
  }*/

  async function buyAndMint(offsets:number): Promise<string> {
    
    const provider = await getProvider();
   
    const sellerAccount = new web3.PublicKey("9wR6MPaeMZyKGn6f53knRAVHrnogAb3mf6cJ8CLmi6Uu")
    const projectAccount = new web3.PublicKey("6qthogdMfaYtdeLrfaCfFtYQAiouRoPpaWsgS7nDoNkH")
    //@ts-ignore
    const buyerAccount = provider.wallet
    //@ts-ignore
    const harmoniaProgram = new Program(idl2, programID, provider);
    //@ts-ignore
    const candyProgram = new Program(idl, programID2, provider);
    const candyProgramId = candyProgram.programId;
    //@ts-ignore
    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);
    let config = new web3.PublicKey(
      "GMxBmPkJsAvC4QJXjroagjBQQmSwdC1qhQhaVGL6cjgB"
    );
    let candyMachineUuid = "GMxBmP";
    
    const mint = web3.Keypair.generate();
    const [candyMachine, bump] = await getCandyMachine(
      config,
      candyMachineUuid,
      candyProgramId
    );
    const token = await getTokenWalletAddress(
      buyerAccount.publicKey,
      mint.publicKey
    );
    const metadata = await getMetadataAddress(mint.publicKey);
    const masterEdition = await getMasterEditionAddress(mint.publicKey);



///before mint:
 await ensureBalance(provider, provider.wallet.publicKey, 2)
 console.log("wallet ok")
     await ensureBalance(provider, sellerAccount, 2)
     console.log("seller ok")
     await ensureBalance(provider, buyerAccount.publicKey, 2)
     console.log("buyer ok")

///

    const tx = await harmoniaProgram.rpc.buyAndMint(new BN(offsets), {
      accounts: {
        project: projectAccount,
        buyer: buyerAccount.publicKey,
        seller: sellerAccount,
        candyProgram: candyProgram.programId,
        config: config,
        candyMachine: candyMachine,
        payer: buyerAccount.publicKey,
        wallet: sellerAccount, // treasury
        mint: mint.publicKey,
        associatedToken: token,
        metadata: metadata,
        masterEdition: masterEdition,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [mint],
    });
    return tx;
  }
  if (!wallet.connected) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "100px",
        }}
      >
        <WalletMultiButton />
      </div>
    );
  } else {
    return (
      <div>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell align="right">Project Name</TableCell>
                <TableCell align="right">CO2e Available (T)</TableCell>
                <TableCell align="right">CO2e Sold (T)</TableCell>
                <TableCell align="right">Price(g)</TableCell>
                <TableCell align="right">owner</TableCell>
                <TableCell><button
                  onClick={() => {
                    buyAndMint(1);
                  }}
                >
                  purchase 1
                </button></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectList.map((row) => (
                <TableRow
                //@ts-ignore
                  key={row}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {row.name}
                  </TableCell>
                  <TableCell align="right">{row.number}</TableCell>
                  <TableCell align="right">{row.price}</TableCell>
                  {<TableCell align="right">{row.address}</TableCell>}
                  {<TableCell align="right">{row.owner}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div>
          {!value && (
            <button
              onClick={() => {
                setValue("connected");
              }}
            >
              Initialize
            </button>
          )}
          {value ? (
            <div>
              <h2>{value}</h2>
              <input
                placeholder="name"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
              <input
                placeholder="number"
                //@ts-ignore
                onChange={(e) => setNumber(e.target.value)}
              />
              <input
                placeholder="amount"
                //@ts-ignore
                                onChange={(e) => setPrice(e.target.value)}
              />
              <button onClick={() => update(name, number, price)}>
                Create New Project
              </button>
            </div>
          ) : (
            <h3>Click here to Initialize</h3>
          )}
        </div>
      </div>
    );
  }
}
