import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Connection } from "@solana/web3.js";
import { Provider } from "@project-serum/anchor";
const opts = {
  preflightCommitment: "processed",
};
export default async function getProvider() {
  const network = "http://127.0.0.1:8899";
  const connection = new Connection(network, opts.preflightCommitment);
  const provider = new Provider(connection, wallet, opts.preflightCommitment);
  return provider;
}

async function render() {
  const provider = await getProvider();
  ReactDOM.render(
    <React.StrictMode>
      <App data={provider} />
    </React.StrictMode>,
    document.getElementById("root")
  );
}
render();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
