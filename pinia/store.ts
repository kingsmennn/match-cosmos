import { defineStore } from "pinia";
import { CreateStoreDTO, Store, STORE_STORE_KEY } from "@/types";
import { useUserStore } from "./user";
import { LOCATION_DECIMALS } from "@/utils/constants";
import BN from "bn.js";
const env = useRuntimeConfig().public;

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

        const long = new BN(
          Math.trunc(longitude * 10 ** LOCATION_DECIMALS).toString()
        );
        const lat = new BN(
          Math.trunc(latitude * 10 ** LOCATION_DECIMALS).toString()
        );

        await contract.execute(
          userStore.accountId!,
          env.contractId,
          {
            create_store: {
              name,
              description,
              phone,
              latitude: lat,
              longitude: long,
            },
          },
          "auto"
        );

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

        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_user_stores: {
            address: accountId,
          },
        });

        throw new Error("not implemented");

        // if (result.isErr) {
        //   throw new Error(result.asErr.toString());
        // } else {
        //   const userInfo = output?.toJSON();
        //   const userData = (userInfo as any)?.ok;

        //   const response: Store[] = userData.map((store: any) => {
        //     return {
        //       id: store.id.toString(),
        //       name: store.name,
        //       description: store.description,
        //       phone: store.phone,
        //       location: [
        //         Number(store.location.longitude.toString()),
        //         Number(store.location.latitude.toString()),
        //       ],
        //     };
        //   });

        //   userStore.storeDetails = response;
        //   return response;
        // }
      } catch (error) {
        console.log({ error });
        throw error;
      }
    },
  },
});
