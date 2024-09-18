import { defineStore } from "pinia";
import { CreateStoreDTO, Store, STORE_STORE_KEY } from "@/types";
import {
  storageDepositLimit,
  useUserStore,
} from "./user";
import { MAX_CALL_WEIGHT, PROOFSIZE } from "@/utils/constants";
import { LOCATION_DECIMALS } from "@/utils/constants";

import { BN, BN_ONE } from "@polkadot/util";
import { web3FromAddress } from "@polkadot/extension-dapp";
import type { WeightV2 } from "@polkadot/types/interfaces";
import { getPolkadotContractResult } from "@/utils/contract-utils";
export const useStoreStore = defineStore(STORE_STORE_KEY, {
  state: () => ({}),
  getters: {},
  actions: {
    async createStore({
      name,
      description,
      phone,
      latitude,
      longitude,
    }: CreateStoreDTO): Promise<any | undefined> {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const injector = await web3FromAddress(userStore.accountId!);
        const api = await userStore.polkadotApi();

        const long = new BN(
          Math.trunc(longitude * 10 ** LOCATION_DECIMALS).toString()
        );
        const lat = new BN(
          Math.trunc(latitude * 10 ** LOCATION_DECIMALS).toString()
        );
        const { gasRequired } = await contract.query.createStore(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          name,
          description,
          phone,
          lat,
          long
        );
        await new Promise(async (resolve, reject) => {
          await contract.tx
            .createStore(
              {
                gasLimit: api?.registry.createType(
                  "WeightV2",
                  gasRequired
                ) as WeightV2,
                storageDepositLimit,
              },
              name,
              description,
              phone,
              lat,
              long
            )
            .signAndSend(
              userStore.accountId!,
              { signer: injector.signer },
              (result) => {
                try {
                  const success = getPolkadotContractResult({
                    result,
                    api: api!,
                  });
                  if (success) {
                    resolve(success);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            );
        });

        userStore.storeDetails = [
          {
            name,
            description,
            phone,
            location: [Number(long), Number(lat)],
          },
        ];
        return undefined;
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }
    },
    async getUserStores(accountId: string): Promise<Store[] | undefined> {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getUserStores(
          accountId,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          accountId
        );
        if (result.isErr) {
          throw new Error(result.asErr.toString());
        } else {
          const userInfo = output?.toJSON();
          const userData = (userInfo as any)?.ok;

          const response: Store[] = userData.map((store: any) => {
            return {
              id: store.id.toString(),
              name: store.name,
              description: store.description,
              phone: store.phone,
              location: [
                Number(store.location.longitude.toString()),
                Number(store.location.latitude.toString()),
              ],
            };
          });

          userStore.storeDetails = response;
          return response;
        }
      } catch (error) {
        console.log({ error });
        throw error;
      }
    },
  },
});
