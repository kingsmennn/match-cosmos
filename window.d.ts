// global.d.ts or window.d.ts
// import {
//   ChainInfoWithoutEndpoints,
//   Keplr,
//   Window as KeplrWindow,
// } from "@keplr-wallet/types";

interface Ethereum {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  // Add more types as needed
}

interface Solana {
  isPhantom?: boolean;
  connect: () => Promise<any>;
  disconnect: () => any;
  publicKey: string;
}

export interface Keplr {
  readonly version: string;
}

interface Window {
  ethereum?: Ethereum;
  solana?: Solana;
  keplr?: Keplr;
  getOfflineSigner: any;
}
