import { defineStore } from "pinia";
import {
  AccountType,
  BlockchainUser,
  CreateUserDTO,
  STORE_KEY,
  STORE_KEY_MIDDLEWARE,
  User,
  Location,
  Store,
} from "@/types";
import { cosmosConfig, LOCATION_DECIMALS } from "@/utils/constants";
import { useStoreStore } from "./store";
import { SigningCosmWasmClient, setupWebKeplr } from "cosmwasm";
import { marketAbi } from "@/blockchain/abi";
import { connectExtension } from "@/utils/connect_web3";
import { BN, BN_ONE } from "@polkadot/util";
import type { WeightV2 } from "@polkadot/types/interfaces";
import { MAX_CALL_WEIGHT, PROOFSIZE } from "@/utils/constants";

import {
  web3AccountsSubscribe,
  web3FromAddress,
} from "@polkadot/extension-dapp";
import { ApiPromise, WsProvider } from "@polkadot/api";

import { ContractPromise } from "@polkadot/api-contract";
import { getPolkadotContractResult } from "@/utils/contract-utils";

type UserStore = {
  accountId: string | null;
  userDetails?: BlockchainUser;
  storeDetails?: Store[];
  blockchainError: {
    userNotFound: boolean;
    message?: string;
  };
  locationEnabled: boolean;
};

const env = useRuntimeConfig().public;

export const storageDepositLimit = null;
let apiInstance: SigningCosmWasmClient | null = null;

export const useUserStore = defineStore(STORE_KEY, {
  state: (): UserStore => ({
    accountId: null,
    userDetails: undefined,
    storeDetails: undefined,
    blockchainError: {
      userNotFound: false,
    },
    locationEnabled: false,
  }),
  getters: {
    isConnected: (state) => !!state.accountId,
    userId: (state): number | undefined => state.userDetails?.[0],
    isNotOnboarded: (state) =>
      !!state.accountId && state.blockchainError.userNotFound,
    passedSecondaryCheck: (state) => {
      return state.userDetails?.[6] === AccountType.BUYER
        ? !!state.userDetails?.[3][0] // buyers only need to give access to their location
        : !!state?.storeDetails?.[0]?.name; // sellers need to set up their store
    },
    username: (state) => state.userDetails?.[1],
    phone: (state) => state.userDetails?.[2],
    location: (state) => state.userDetails?.[3],
    accountType: (state) => state.userDetails?.[6],
  },
  actions: {
    async setUpPolkadotConnectEvents() {
      this.connectToCosmos();
      web3AccountsSubscribe((accounts) => {
        if (accounts.length) {
          this.blockchainError.userNotFound = false;
          this.accountId = accounts[0].address;
          this.connectToCosmos();
        }
      });
    },
    async connectToCosmos() {
      try {
        if (!window.getOfflineSigner || !window.keplr) {
          throw new Error("Keplr extension not installed");
        }
        const keplr = window.keplr;

        await keplr.experimentalSuggestChain(cosmosChainInfo);

        await keplr.enable(cosmosChainInfo.chainId);

        const offlineSigner = window.getOfflineSigner(cosmosChainInfo.chainId);

        const accounts = await offlineSigner.getAccounts();

        this.accountId = accounts![0].address;

        const blockchainUser = await this.fetchUser(this.accountId!);

        this.storeUserDetails(blockchainUser);

        this.fetchLocationPreference().then((res) => {
          this.locationEnabled = res;
        });

        if (this.accountType === AccountType.SELLER) {
          const storeStore = useStoreStore();
          const res = await storeStore.getUserStores(this.accountId!);
          this.storeDetails = res || [];
        }
      } catch (error) {
        console.error("Failed to connect to Wallet:", error);
      }
    },
    async getContract() {
      const api = await this.cosmosApi();
      return api;
    },

    async disconnect() {
      try {
        this.accountId = null;
        this.userDetails = undefined;
        this.storeDetails = undefined;
        this.blockchainError.userNotFound = false;
        this.locationEnabled = false;
        const userCookie = useCookie<User | null>(STORE_KEY_MIDDLEWARE, {
          watch: true,
        });
        userCookie.value = null;
      } catch (error) {
        console.error("Error disconnecting:", error);
      }
    },

    async fetchUser(account_id: string): Promise<any> {
      const contract = await this.getContract();

      try {
        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_user: {
            account_id,
          },
        });

        throw new Error("Not implemented");
        // if (result.isErr) {
        //   throw new Error(result.asErr.toString());
        // } else {
        // const userInfo = output?.toJSON();
        // const userData = (userInfo as any)?.ok;

        // const results = [
        //   Number(userData.id),
        //   userData.username,
        //   userData.phone,
        //   [
        //     Number(userData.location.longitude),
        //     Number(userData.location.latitude),
        //   ],
        //   Number(userData.createdAt),
        //   Number(userData.updatedAt),
        //   Number(
        //     userData.accountType.toLowerCase() === AccountType.BUYER ? 0 : 1
        //   ),
        // ];
        // return results;
        // }
      } catch (error) {
        console.log({ error });
        return [0, "", "", [0, 0], 0, 0, 0];
      }
    },

    async storeUserDetails(user: BlockchainUser) {
      const userCookie = useCookie<User>(STORE_KEY_MIDDLEWARE, { watch: true });

      const hasId = !!user[0];

      if (hasId) {
        const details = {
          id: Number(user[0]),
          username: user[1],
          phone: user[2],
          location: {
            long: Number(user[3][0]),
            lat: Number(user[3][1]),
          },
          createdAt: Number(user[4]),
          updatedAt: Number(user[5]),
          accountType:
            Number(user[6]) === 0 ? AccountType.BUYER : AccountType.SELLER,
        };

        this.userDetails = [
          details.id,
          details.username,
          details.phone,
          [details.location.long, details.location.lat],
          details.createdAt,
          details.updatedAt,
          details.accountType,
        ];

        userCookie.value = {
          id: this.accountId!,
          username: details.username,
          phone: details.phone,
          location: [details.location.long, details.location.lat],
          createdAt: new Date(details.createdAt),
          updatedAt: new Date(details.updatedAt),
          accountType: details.accountType,
        };
      } else if (!hasId && this.accountId) {
        this.blockchainError.userNotFound = true;
      }
    },

    async createUser({
      username,
      phone,
      lat,
      long,
      account_type,
    }: CreateUserDTO): Promise<string | undefined> {
      try {
        const contract = await this.getContract();
        const result = await contract.execute(
          this.accountId!,
          env.contractId,
          {
            create_user: {
              username,
              phone,
              lat,
              long,
              account_type,
            },
          },
          "auto"
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const blockchainUser = await this.fetchUser(this.accountId!);
        this.storeUserDetails(blockchainUser);

        this.blockchainError.userNotFound = false;
        return undefined;
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }
    },

    async updateUser({
      username,
      phone,
      lat,
      long,
      account_type,
    }: Partial<CreateUserDTO>): Promise<
      { tx: string; location: Location } | undefined
    > {
      try {
        const contract = await this.getContract();

        const payload = {
          username: username || this.userDetails?.[1],
          phone: phone || this.userDetails?.[2],
          lat: new BN(
            Math.trunc(
              (lat || this.userDetails?.[3][1]!) * 10 ** LOCATION_DECIMALS
            ).toString()
          ),
          lng: new BN(
            Math.trunc(
              (long || this.userDetails?.[3][0]!) * 10 ** LOCATION_DECIMALS
            ).toString()
          ),
          account_type: account_type == AccountType.BUYER ? 0 : 1,
        };

        const result = await contract.execute(
          this.accountId!,
          env.contractId,
          {
            update_user: {
              username: payload.username,
              phone: payload.phone,
              lat: payload.lat,
              long: payload.lng,
              account_type: payload.account_type,
            },
          },
          "auto"
        );

        return {
          tx: "",
          location: [Number(payload.lng), Number(payload.lat)],
        };
      } catch (error) {
        console.error("Error updating user:", error);
        throw error;
      }
    },
    async toggleEnableLocation(value: boolean) {
      try {
        const contract = await this.getContract();
        const result = await contract.execute(
          this.accountId!,
          env.contractId,
          {
            toggle_location_preference: {
              enabled: value,
            },
          },
          "auto"
        );
      } catch (error) {
        console.error("Error updating user:", error);
        throw error;
      }
    },
    async fetchLocationPreference(): Promise<boolean> {
      try {
        const contract = await this.getContract();
        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_location_preference: {},
        });

        return true;
      } catch (error) {
        console.error("Error fetching location preference:", error);
        throw error;
      }
    },
    async fetchUserById(userId: number) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getUserById(
          this.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          userId
        );
        if (result.isErr) {
          throw new Error(result.asErr.toString());
        }
        const userInfo = output?.toJSON();
        const userData = (userInfo as any)?.ok;

        userData.stores = [];
        try {
          const { result: storeResult, output: storeOutput } =
            await contract.query.getUserStores(
              this.accountId!,
              {
                gasLimit: api?.registry.createType("WeightV2", {
                  refTime: MAX_CALL_WEIGHT,
                  proofSize: PROOFSIZE,
                }) as WeightV2,
                storageDepositLimit,
              },
              userData.authority
            );

          if (storeResult.isErr) {
            throw new Error(result.asErr.toString());
          }
          const storeInfo = storeOutput?.toJSON();
          const storeData = (storeInfo as any)?.ok;
          userData.userAddress = userData.authority;
          userData.stores = storeData.map((store: any) => {
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
        } catch (_) {}
        return userData;
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
    async cosmosApi() {
      if (apiInstance) {
        return apiInstance;
      }
      apiInstance = await SigningCosmWasmClient.connectWithSigner(
        cosmosChainInfo.rpc,
        window.getOfflineSigner(cosmosChainInfo.chainId)
      );
      return apiInstance;
    },

    async getUserLocation() {
      const env = useRuntimeConfig().public;

      const requestBody = {
        considerIp: true, // Uses the IP address if no other data is available
        // Optionally, you can provide information about WiFi access points and cell towers
      };

      const response = await $fetch(
        `https://www.googleapis.com/geolocation/v1/geolocate?key=${env.googleMapsApiKey}`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return response as {
        location: {
          lat: number;
          lng: number;
        };
        accuracy: number;
      };
    },
  },
  persist: {
    paths: [
      "accountId",
      "userDetails",
      "blockchainError.userNotFound",
      "locationEnabled",
      "storeDetails.name",
      "storeDetails.description",
      "storeDetails.location",
    ],
    async afterRestore(context) {
      console.log("store restored");

      if (context.store.accountId) {
        await context.store.setUpPolkadotConnectEvents();
      }
    },
  },
});
