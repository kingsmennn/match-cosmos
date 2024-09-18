import { toast } from "vue-sonner";
import {
  web3Enable,
  web3Accounts,
  web3FromAddress,
  web3FromSource,
} from "@polkadot/extension-dapp";
import {
  cryptoWaitReady,
  decodeAddress,
  signatureVerify,
} from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { ApiPromise, WsProvider } from "@polkadot/api";

import type {
  InjectedAccountWithMeta,
  InjectedExtension,
} from "@polkadot/extension-inject/types";
import { stringToHex } from "@polkadot/util";

const activeConnection: InjectedExtension[] = [];
const accountConnected: InjectedAccountWithMeta[] = [];

const isValidSignature = (
  signedMessage: string,
  signature: string,
  address: string
): any => {
  const publicKey = decodeAddress(address);
  const hexPublicKey = u8aToHex(publicKey);

  return signatureVerify(signedMessage, signature, hexPublicKey).isValid;
};

const signMessage = async (accounts: InjectedAccountWithMeta[]) => {
  if (accounts.length == 0) {
    toast.error("Please connect your wallet first");
    return;
  }
  const account = accounts[0];

  // to be able to retrieve the signer interface from this account
  // we can use web3FromSource which will return an InjectedExtension type
  const injector = await web3FromSource(account.meta.source);

  // this injector object has a signer and a signRaw method
  // to be able to sign raw bytes
  const signRaw = injector?.signer?.signRaw;

  if (!!signRaw) {
    // after making sure that signRaw is defined
    // we can use it to sign our message
    let message = "I am signing this message to prove that I own this account";
    const { signature } = await signRaw({
      address: account.address,
      data: stringToHex(message),
      type: "bytes",
    });

    await cryptoWaitReady();
    const isValid = isValidSignature(message, signature, account.address);
    if (isValid) return accounts;
  }
};
export const connectExtension = async () => {
  const config = useRuntimeConfig();
  if (accountConnected.length > 0) return;
  let activeExtension: InjectedExtension[] = await web3Enable(
    config.public.appName
  );

  if (activeExtension.length == 0) {
    return;
  }

  let accounts: InjectedAccountWithMeta[] = await web3Accounts();

  return accounts;
};
