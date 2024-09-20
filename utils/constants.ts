export const chainName = "Sepolia";
const env = useRuntimeConfig().public;

const chains: {
  [key: number]: {
    name: string;
    chainId: number;
    blockExplorer: string;
  };
} = {
  11155111: {
    name: "Sepolia",
    chainId: 11155111,
    blockExplorer: "https://sepolia.etherscan.io",
  },
  80002: {
    name: "Amoy",
    chainId: 80002,
    blockExplorer: "https://amoy.polygonscan.com/",
  },
  97: {
    name: "BSC Testnet",
    chainId: 97,
    blockExplorer: "https://testnet.bscscan.com",
  },
  1337: {
    name: "BSC Testnet",
    chainId: 1337,
    blockExplorer: "https://testnet.bscscan.com",
  },
};

export const chainInfo = chains[+env.chainId];

export const LOCATION_DECIMALS = 18;
export const PROJECT_ID = "73801621aec60dfaa2197c7640c15858";
export const DEBUG = true;
export const appMetaData = {
  name: "Finder",
  description:
    "Finder is a blockchain application that allows buyers to find the best deals on products they want to buy.",
  icons: [window.location.origin + "/favicon.ico"],
  url: window.location.origin,
};

export const TIME_TILL_LOCK = 15 * 60 * 1000;

export const cosmosChainInfo = {
  chainId: "xion-testnet-1",
  chainName: "xion-testnet-1",
  rpc: "https://rpc.xion-testnet-1.burnt.com",
  rest: "https://api.xion-testnet-1.burnt.com",
  bip44: {
    coinType: 118,
  },
  coinType: 118,
  bech32Config: {
    bech32PrefixAccAddr: "xion",
    bech32PrefixAccPub: "xionpub",
    bech32PrefixValAddr: "xionvaloper",
    bech32PrefixValPub: "xionvaloperpub",
    bech32PrefixConsAddr: "xionvalcons",
    bech32PrefixConsPub: "xionvalconspub",
  },
  currencies: [
    {
      coinDenom: "XION",
      coinMinimalDenom: "uxion",
      coinDecimals: 6,
      coinGeckoId: "xion",
    },
  ],
  feeCurrencies: [
    {
      coinDenom: "XION",
      coinMinimalDenom: "uxion",
      coinDecimals: 6,
      coinGeckoId: "xion",
      gasPriceStep: {
        low: 0.01,
        average: 0.025,
        high: 0.03,
      },
    },
  ],
  gasPriceStep: {
    low: 0.01,
    average: 0.025,
    high: 0.03,
  },
  stakeCurrency: {
    coinDenom: "XION",
    coinMinimalDenom: "uxion",
    coinDecimals: 6,
    coinGeckoId: "xion",
  },
  features: ["ibc-go", "ibc-transfer", "no-legacy-stdTx"],
};
