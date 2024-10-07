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
import { LOCATION_DECIMALS } from "@/utils/constants";
import { useStoreStore } from "./store";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  Coin,
  DeliverTxResponse,
  SigningStargateClient,
  StdFee,
} from "@cosmjs/stargate";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { toUtf8 } from "@cosmjs/encoding";
import { Registry } from "@cosmjs/proto-signing";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";

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

export const env = useRuntimeConfig().public;

export const storageDepositLimit = null;
let apiInstance: SigningCosmWasmClient | null = null;
let apiInstanceExec: SigningStargateClient | null = null;

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
    async setUpCosmosConnectEvents() {
      this.connectToCosmos();
      // web3AccountsSubscribe((accounts) => {
      //   if (accounts.length) {
      //     this.blockchainError.userNotFound = false;
      //     this.accountId = accounts[0].address;
      //     this.connectToCosmos();
      //   }
      // });
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

      return {
        queryContractSmart: api.queryContractSmart.bind(api),
        execute: async (
          senderAddress: string,
          contractAddress: string,
          msg: Record<string, unknown>,
          fee: StdFee | "auto" | number,
          memo?: string,
          funds?: readonly Coin[]
        ): Promise<DeliverTxResponse> => {
          const contract = await this.cosmosApiExecute();

          const mutableFunds: Coin[] = funds ? [...funds] : [];
          const executeMsg = {
            typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
            value: MsgExecuteContract.fromPartial({
              sender: senderAddress,
              contract: contractAddress,
              msg: toUtf8(JSON.stringify(msg)),
              funds: mutableFunds,
            }),
          };
          const result = await contract.signAndBroadcast(
            senderAddress,
            [executeMsg],
            fee,
            memo
          );

          if (result.code !== 0) {
            throw new Error(`Failed to execute contract: ${result.code}`);
          }

          return result;
        },
      };
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
        const userData = await contract.queryContractSmart(env.contractId, {
          get_user: {
            address: account_id,
          },
        });

        const results = [
          Number(userData.id),
          userData.username,
          userData.phone,
          [
            Number(userData.location.longitude),
            Number(userData.location.latitude),
          ],
          Number(userData.created_at),
          Number(userData.updated_at),
          Number(userData.account_type === AccountType.BUYER ? 0 : 1),
        ];

        return results;
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
        await contract.execute(
          this.accountId!,
          env.contractId,
          {
            create_user: {
              username,
              phone,
              latitude: lat.toString(),
              longitude: long.toString(),
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
          lat: Math.trunc(
            (lat || this.userDetails?.[3][1]!) * 10 ** LOCATION_DECIMALS
          ).toString(),
          lng: Math.trunc(
            (long || this.userDetails?.[3][0]!) * 10 ** LOCATION_DECIMALS
          ).toString(),
          account_type: account_type == AccountType.BUYER ? 0 : 1,
        };

        const result = await contract.execute(
          this.accountId!,
          env.contractId,
          {
            update_user: {
              username: payload.username,
              phone: payload.phone,
              latitude: payload.lat,
              longitude: payload.lng,
              account_type,
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
            toggle_location: {
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
          get_location_preference: {
            address: this.accountId!,
          },
        });

        return queryResult;
      } catch (error) {
        console.error("Error fetching location preference:", error);
        throw error;
      }
    },
    async fetchUserById(userId: number) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_user_by_id: {
            user_id: userId,
          },
        });

        const userData = queryResult;
        userData.userAddress = userData.authority;

        const storeQuery = await contract.queryContractSmart(env.contractId, {
          get_user_stores: {
            address: queryResult.authority,
          },
        });

        userData.stores = storeQuery.map((store: any) => {
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
        window.getOfflineSigner(cosmosChainInfo.chainId),
        {
          gasPrice: {
            amount: Decimal.fromUserInput("0.025", 6), // Amount of gas price
            denom: "uatom", // Denomination of the token used for fees (example for Cosmos)
          },
        }
      );
      return apiInstance;
    },
    async cosmosApiExecute() {
      if (apiInstanceExec) {
        return apiInstanceExec;
      }

      apiInstanceExec = await SigningStargateClient.connectWithSigner(
        cosmosChainInfo.rpc,
        window.getOfflineSigner(cosmosChainInfo.chainId),
        {
          gasPrice: {
            amount: Decimal.fromUserInput("0.025", 6), // Amount of gas price
            denom: "uatom", // Denomination of the token used for fees (example for Cosmos)
          },
          registry: new Registry([
            ...defaultRegistryTypes,
            ["/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract],
          ]),
        }
      );
      return apiInstanceExec;
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
        await context.store.setUpCosmosConnectEvents();
      }
    },
  },
});
