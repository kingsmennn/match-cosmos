import type { ISubmittableResult } from "@polkadot/types/types";
import { ApiPromise, WsProvider } from "@polkadot/api";
export const getEvmAddress = async (account_id: string) => {
  return account_id;
};

export const getPolkadotContractResult = ({
  result,
  api,
}: {
  result: ISubmittableResult;
  api: ApiPromise;
}): boolean | undefined => {
  try {
    if (result.dispatchError) {
      if (result.dispatchError.isModule) {
        const decoded = api.registry.findMetaError(
          result.dispatchError.asModule
        );
        const { name, section } = decoded;
        throw new Error(`${section}.${name}}`);
      } else {
        throw new Error(result.dispatchError.toString());
      }
    }

    if (result.isError) {
      throw new Error("Transaction failed");
    }

    if (result.status.isFinalized) {
      return true;
    }
  } catch (error) {
    console.log({ error });
    throw error;
  }
};
