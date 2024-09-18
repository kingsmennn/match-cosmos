import { defineStore } from "pinia";
import {
  CreateOfferDTO,
  CreateRequestDTO,
  Offer,
  RequestLifecycleIndex,
  RequestResponse,
} from "@/types";

import {
  storageDepositLimit,
  useUserStore,
} from "./user";
import { MAX_CALL_WEIGHT, PROOFSIZE } from "@/utils/constants";

import { BN, BN_ONE } from "@polkadot/util";
import { web3FromAddress } from "@polkadot/extension-dapp";
import type { WeightV2 } from "@polkadot/types/interfaces";
import { getPolkadotContractResult } from "@/utils/contract-utils";
type RequestsStoreType = {
  list: RequestResponse[];
};
export const useRequestsStore = defineStore("requests", {
  state: (): RequestsStoreType => ({
    list: [],
  }),
  getters: {
    hasLocked() {
      return ({ updatedAt, period }: { updatedAt: Date; period: number }) => {
        const updatedAtTime = updatedAt.getTime();
        const currentTime = Date.now();

        return currentTime >= updatedAtTime + period;
      };
    },
  },
  actions: {
    async createRequest({
      name,
      description,
      images,
      latitude,
      longitude,
    }: CreateRequestDTO): Promise<any | undefined> {
      const userStore = useUserStore();

      try {
        const injector = await web3FromAddress(userStore.accountId!);
        const api = await userStore.polkadotApi();
        const contract = await userStore.getContract();

        const { gasRequired } = await contract.query.createRequest(
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
          [...images],
          new BN(Math.trunc(latitude).toString()),
          new BN(Math.trunc(longitude).toString())
        );
        const result = await new Promise(async (resolve, reject) => {
          const requestData = await contract.tx
            .createRequest(
              {
                gasLimit: api?.registry.createType(
                  "WeightV2",
                  gasRequired
                ) as WeightV2,
                storageDepositLimit,
              },
              name,
              description,
              [...images],
              new BN(Math.trunc(latitude).toString()),
              new BN(Math.trunc(longitude).toString())
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
                    resolve(requestData);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            );
        });

        return result;
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }
    },
    async fetchAllUserRequests(accountId: string) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getUserRequests(
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
        }
        const userInfo = output?.toJSON();
        const userData = (userInfo as any)?.ok;

        const res: any = userData.map((request: any) => {
          const lifecycle_ = request.lifecycle.toUpperCase();

          let lifecycle: RequestLifecycleIndex = RequestLifecycleIndex.PENDING;

          Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
            if (key.replaceAll("_", "") === lifecycle_) {
              lifecycle = value as RequestLifecycleIndex;
            }
          });

          return {
            requestId: Number(request.id),
            requestName: request.name,
            buyerId: Number(request.buyerId),
            sellersPriceQuote: Number(request.sellersPriceQuote),
            lockedSellerId: Number(request.lockedSellerId),
            description: request.description,
            lifecycle,
            longitude: Number(request.location.longitude.toString()),
            latitude: Number(request.location.latitude.toString()),
            createdAt: Number(request.createdAt.toString() / 1000),
            updatedAt: Number(request.updatedAt.toString() / 1000),
            images: request.images,
          };
        });

        this.list = res;
        return res;
      } catch (error) {
        console.log({ error });
        throw error;
      }
    },
    async fetchAllSellersRequests(accountId: string) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getSellerOffers(
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
        }

        const offersData = output?.toJSON();

        const offers = (offersData as any).ok;

        const requests = [];

        for (const offer of offers) {
          const { output: requestOutput } = await contract.query.getRequest(
            accountId,
            {
              gasLimit: api?.registry.createType("WeightV2", {
                refTime: MAX_CALL_WEIGHT,
                proofSize: PROOFSIZE,
              }) as WeightV2,
              storageDepositLimit,
            },
            offer.requestId
          );

          const requestData = (requestOutput?.toJSON() as any).ok;

          if (requestData) {
            const lifecycle_ = requestData.lifecycle.toUpperCase();
            let lifecycle: RequestLifecycleIndex =
              RequestLifecycleIndex.PENDING;
            Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
              if (key.replaceAll("_", "") === lifecycle_) {
                lifecycle = value as RequestLifecycleIndex;
              }
            });

            requests.push({
              requestId: Number(requestData.id),
              requestName: requestData.name,
              buyerId: Number(requestData.buyerId),
              sellersPriceQuote: Number(requestData.sellersPriceQuote),
              lockedSellerId: Number(requestData.lockedSellerId),
              description: requestData.description,
              lifecycle,
              longitude: Number(requestData.location.longitude.toString()),
              latitude: Number(requestData.location.latitude.toString()),
              createdAt: Number(requestData.createdAt.toString() / 1000),
              updatedAt: Number(requestData.updatedAt.toString() / 1000),
              images: requestData.images,
            });
          }
        }

        this.list = requests;
        return requests;
      } catch (error) {
        console.error("Error fetching seller requests:", error);
        throw error;
      }
    },
    async getRequest(requestId: number) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getRequest(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          requestId
        );

        if (result.isErr) {
          throw new Error(result.asErr.toString());
        } else {
          const userInfo = output?.toJSON();
          const userData = (userInfo as any)?.ok;

          const lifecycle_ = userData.lifecycle.toUpperCase();

          let lifecycle: RequestLifecycleIndex = RequestLifecycleIndex.PENDING;

          Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
            if (key.replaceAll("_", "") === lifecycle_) {
              lifecycle = value as RequestLifecycleIndex;
            }
          });

          return {
            requestId: Number(userData.id),
            requestName: userData.name,
            buyerId: Number(userData.buyerId),
            sellersPriceQuote: Number(userData.sellersPriceQuote),
            lockedSellerId: Number(userData.lockedSellerId),
            description: userData.description,
            lifecycle,
            longitude: Number(userData.location.longitude.toString()),
            latitude: Number(userData.location.latitude.toString()),
            createdAt: Number(userData.createdAt.toString() / 1000),
            updatedAt: Number(userData.updatedAt.toString() / 1000),
            images: userData.images,
          };
        }
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
    async getRequestImages(request_id: number): Promise<string[] | undefined> {
      const userStore = useUserStore();

      const contract = await userStore.getContract();
      // const length = await contract.getRequestImagesLength(request_id);

      // const images = [];
      // for (let i = 0; i < length; i++) {
      //   const image = await contract.getRequestImageByIndex(request_id, i);
      //   images.push(image);
      // }
      return [];
    },

    // SELLERS
    async fetchNearbyRequestsForSellers({
      lat,
      long,
    }: {
      lat: number;
      long: number;
    }) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getAllRequests(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          }
        );

        if (result.isErr) {
          throw new Error(result.asErr.toString());
        } else {
          const userInfo = output?.toJSON();
          const userData = (userInfo as any)?.ok;
          const res: any = userData.map((request: any) => {
            const lifecycle_ = request.lifecycle.toUpperCase();

            let lifecycle: RequestLifecycleIndex =
              RequestLifecycleIndex.PENDING;

            Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
              if (key.replaceAll("_", "") === lifecycle_) {
                lifecycle = value as RequestLifecycleIndex;
              }
            });

            return {
              requestId: Number(request.id),
              requestName: request.name,
              buyerId: Number(request.buyerId),
              sellersPriceQuote: Number(request.sellersPriceQuote),
              lockedSellerId: Number(request.lockedSellerId),
              description: request.description,
              lifecycle,
              longitude: Number(request.location.longitude.toString()),
              latitude: Number(request.location.latitude.toString()),
              createdAt: Number(request.createdAt.toString() / 1000),
              updatedAt: Number(request.updatedAt.toString() / 1000),
              images: request.images,
            };
          });

          this.list = res;
          return res;
        }
      } catch (error) {
        console.log({ error });
        throw error;
      }
    },
    async createOffer({
      price,
      images,
      requestId,
      storeName,
    }: CreateOfferDTO): Promise<any | undefined> {
      const userStore = useUserStore();

      try {
        const injector = await web3FromAddress(userStore.accountId!);
        const api = await userStore.polkadotApi();
        const contract = await userStore.getContract();

        const { gasRequired } = await contract.query.createOffer(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          requestId,
          price,
          [...images],
          storeName
        );
        const result = await new Promise(async (resolve, reject) => {
          const offerResult = await contract.tx
            .createOffer(
              {
                gasLimit: api?.registry.createType(
                  "WeightV2",
                  gasRequired
                ) as WeightV2,
                storageDepositLimit,
              },
              requestId,
              price,
              [...images],
              storeName
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
                    resolve(offerResult);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            );
        });

        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    async acceptOffer(offerId: number): Promise<any | undefined> {
      const userStore = useUserStore();
      try {
        const injector = await web3FromAddress(userStore.accountId!);
        const api = await userStore.polkadotApi();
        const contract = await userStore.getContract();

        const { gasRequired } = await contract.query.acceptOffer(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          offerId
        );
        const result = await new Promise(async (resolve, reject) => {
          const acceptOfferRes = await contract.tx
            .acceptOffer(
              {
                gasLimit: api?.registry.createType(
                  "WeightV2",
                  gasRequired
                ) as WeightV2,
                storageDepositLimit,
              },
              offerId
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
                    resolve(acceptOfferRes);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            );
        });

        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    async fetchAllOffers(requestId: number) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();
        const api = await userStore.polkadotApi();

        const { result, output } = await contract.query.getOfferByRequest(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          requestId
        );

        if (result.isErr) {
          throw new Error(result.asErr.toString());
        } else {
          const userInfo = output?.toJSON();
          const userData = (userInfo as any)?.ok;
          console.log(userData);

          const res: any = userData.map((offer: any) => {
            const offer_: Offer = {
              id: Number(offer.id),
              offerId: Number(offer.id),
              price: Number(offer.price),
              images: offer.images,
              requestId: offer.requestId,
              storeName: offer.storeName,
              sellerId: offer.sellerId,
              isAccepted: offer.isAccepted,
              createdAt: new Date(Number(offer.createdAt)),
              updatedAt: new Date(Number(offer.updatedAt)),
            };

            return offer_;
          });

          return res;
        }
      } catch (error) {
        console.log({ error });
        throw error;
      }
    },
    async markRequestAsCompleted(requestId: number) {
      try {
        const userStore = useUserStore();
        const injector = await web3FromAddress(userStore.accountId!);
        const api = await userStore.polkadotApi();
        const contract = await userStore.getContract();

        const { gasRequired } = await contract.query.markRequestAsCompleted(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          requestId
        );

        const result = await new Promise(async (resolve, reject) => {
          const markResult = await contract.tx
            .markRequestAsCompleted(
              {
                gasLimit: api?.registry.createType(
                  "WeightV2",
                  gasRequired
                ) as WeightV2,
                storageDepositLimit,
              },
              requestId
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
                    resolve(markResult);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            );
        });

        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    async deleteRequest(requestId: number) {
      try {
        const userStore = useUserStore();
        const injector = await web3FromAddress(userStore.accountId!);
        const api = await userStore.polkadotApi();
        const contract = await userStore.getContract();

        const { gasRequired } = await contract.query.deleteRequest(
          userStore.accountId!,
          {
            gasLimit: api?.registry.createType("WeightV2", {
              refTime: MAX_CALL_WEIGHT,
              proofSize: PROOFSIZE,
            }) as WeightV2,
            storageDepositLimit,
          },
          requestId
        );
        const result = await new Promise(async (resolve, reject) => {
          const deleteRequest = await contract.tx
            .deleteRequest(
              {
                gasLimit: api?.registry.createType(
                  "WeightV2",
                  gasRequired
                ) as WeightV2,
                storageDepositLimit,
              },
              requestId
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
                    resolve(deleteRequest);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            );
        });

        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    removeDeletedRequestFromList(requestId: number) {
      this.list = this.list.filter(
        (request) => request.requestId !== requestId
      );
    },
  },
});
