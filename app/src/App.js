import "./App.css";
import { BrowserRouter, Route } from "react-router-dom";
import Home from "./home";

import Marketplace from "./marketplace";
import Registry2 from "./registry2";
import Registry3 from "./registry3";
import { getPhantomWallet } from "@solana/wallet-adapter-wallets";
import {
  WalletProvider,
  ConnectionProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import Registry from "./registry";

const wallets = [getPhantomWallet()];

const AppWithProvider = () => (
  <ConnectionProvider endpoint="http://127.0.0.1:8899">
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <BrowserRouter>
          <Route path="/home" component={Home} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/registry" component={Registry} />

          <Route path="/registry2" component={Registry2} />
          <Route path="/registry3" component={Registry3} />
        </BrowserRouter>
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);

export default AppWithProvider;
