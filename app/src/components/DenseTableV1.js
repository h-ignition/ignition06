import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, Provider, web3 } from "@project-serum/anchor";
import idl from "../idl.json";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/*function createData(name, calories, fat, carbs, protein) {
  return { name, calories, fat, carbs, protein };
}*/

const { SystemProgram, Keypair } = web3;
const baseAccount = Keypair.generate();
const opts = {
  preflightCommitment: "processed",
};
const programID = new PublicKey(idl.metadata.address);

export default function DenseTable() {
  const [value, setValue] = useState("");
  const [dataList, setDataList] = useState(["testdate"]);
  const [input, setInput] = useState("");
  const wallet = useWallet();

  async function getProvider() {
    const network = "http://127.0.0.1:8899";
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(connection, wallet, opts.preflightCommitment);
    return provider;
  }

  async function update() {
    if (!input) return;
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    await program.rpc.update(input, {
      accounts: {
        baseAccount: baseAccount.publicKey,
      },
    });
    const account = await program.account.baseAccount.fetch(
      baseAccount.publicKey
    );
    console.log("account: ", account);
    setValue(account.data.toString());
    setDataList(account.dataList);
    setInput("");
  }

  async function initialize() {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    try {
      await program.rpc.initialize("Hello World", {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount],
      });
      const account = await program.account.baseAccount.fetch(
        baseAccount.publicKey
      );
      console.log("account: ", account);
      setValue(account.data.toString());
      setDataList(account.dataList);
    } catch (err) {
      console.log("Transaction error: ", err);
    }
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
                <TableCell>Dessert (100g serving)</TableCell>
                <TableCell align="right">Project Name</TableCell>
                <TableCell align="right">CO2e Available (T)</TableCell>
                <TableCell align="right">CO2e Sold (T)</TableCell>
                <TableCell align="right">Protein&nbsp;(g)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dataList.map((row) => (
                <TableRow
                  key={row}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {row}
                  </TableCell>
                  <TableCell align="right">{row}</TableCell>
                  <TableCell align="right">{row}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div>
          {!value && <button onClick={initialize}>Initialize</button>}

          {value ? (
            <div>
              <h2>Current value: {value}</h2>
              <input
                placeholder="name"
                onChange={(e) => setInput(e.target.value)}
                value={input}
              />
              <input
                placeholder="number"
                onChange={(e) => setInput(e.target.value)}
                value={input}
              />
              <input
                placeholder="amount"
                onChange={(e) => setInput(e.target.value)}
                value={input}
              />
              <button onClick={update}>Create New Project</button>
            </div>
          ) : (
            <h3>Click here to Initialize</h3>
          )}
        </div>
      </div>
    );
  }
}
