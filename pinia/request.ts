import { defineStore } from "pinia";
import {
  CreateOfferDTO,
  CreateRequestDTO,
  Offer,
  RequestLifecycleIndex,
  RequestResponse,
} from "@/types";

import BN from "bn.js";

import { useUserStore } from "./user";

const env = useRuntimeConfig().public;
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
        const contract = await userStore.getContract();

        console.log({
          name,
          description,
          images: [...images],
          latitude: Math.trunc(latitude).toString(),
          longitude: Math.trunc(longitude).toString(),
        });

        const result = await contract.execute(
          userStore.accountId!,
          env.contractId,
          {
            create_request: {
              name,
              description,
              images: [...images],
              latitude: Math.trunc(latitude).toString(),
              longitude: Math.trunc(longitude).toString(),
            },
          },
          "auto"
        );

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

        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_user_requests: {
            address: accountId,
          },
        });

        const res = queryResult.map((request: any) => {
          let lifecycle: RequestLifecycleIndex = RequestLifecycleIndex.PENDING;
          Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
            if (
              key.replaceAll("_", "").toLowerCase() ===
              request.lifecycle.toLowerCase()
            ) {
              lifecycle = value as RequestLifecycleIndex;
            }
          });
          return {
            requestId: Number(request.id),
            requestName: request.name,
            buyerId: Number(request.buyer_id),
            sellersPriceQuote: Number(request.seller_price_quote),
            lockedSellerId: Number(request.locked_seller_id),
            description: request.description,
            lifecycle: lifecycle,
            longitude: Number(request.location.longitude.toString()),
            latitude: Number(request.location.latitude.toString()),
            createdAt: Number(request.created_at.toString()),
            updatedAt: Number(request.updated_at.toString()),
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

        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_seller_offers: {
            address: accountId,
          },
        });

        const requests = queryResult.map((request: any) => {
          let lifecycle: RequestLifecycleIndex = RequestLifecycleIndex.PENDING;
          Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
            if (
              key.replaceAll("_", "").toLowerCase() ===
              request.lifecycle.toLowerCase()
            ) {
              lifecycle = value as RequestLifecycleIndex;
            }
          });
          return {
            requestId: Number(request.id),
            requestName: request.name,
            buyerId: Number(request.buyer_id),
            sellersPriceQuote: Number(request.seller_price_quote),
            lockedSellerId: Number(request.locked_seller_id),
            description: request.description,
            lifecycle: lifecycle,
            longitude: Number(request.location.longitude.toString()),
            latitude: Number(request.location.latitude.toString()),
            createdAt: Number(request.created_at.toString()),
            updatedAt: Number(request.updated_at.toString()),
            images: request.images,
          };
        });

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
        console.log({
          get_request: {
            request_id: requestId,
          },
        });

        const request = await contract.queryContractSmart(env.contractId, {
          get_request: {
            request_id: requestId,
          },
        });

        let lifecycle: RequestLifecycleIndex = RequestLifecycleIndex.PENDING;
        Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
          if (
            key.replaceAll("_", "").toLowerCase() ===
            request.lifecycle.toLowerCase()
          ) {
            lifecycle = value as RequestLifecycleIndex;
          }
        });
        console.log({
          requestId: Number(request.id),
          requestName: request.name,
          buyerId: Number(request.buyer_id),
          sellersPriceQuote: Number(request.seller_price_quote),
          lockedSellerId: Number(request.locked_seller_id),
          description: request.description,
          lifecycle: lifecycle,
          longitude: Number(request.location.longitude.toString()),
          latitude: Number(request.location.latitude.toString()),
          createdAt: Number(request.created_at.toString()),
          updatedAt: Number(request.updated_at.toString()),
          images: request.images,
        });
        return {
          requestId: Number(request.id),
          requestName: request.name,
          buyerId: Number(request.buyer_id),
          sellersPriceQuote: Number(request.seller_price_quote),
          lockedSellerId: Number(request.locked_seller_id),
          description: request.description,
          lifecycle: lifecycle,
          longitude: Number(request.location.longitude.toString()),
          latitude: Number(request.location.latitude.toString()),
          createdAt: Number(request.created_at.toString()),
          updatedAt: Number(request.updated_at.toString()),
          images: request.images,
        };
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

        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_all_requests: {},
        });

        const requests = queryResult.map((request: any) => {
          let lifecycle: RequestLifecycleIndex = RequestLifecycleIndex.PENDING;
          Object.entries(RequestLifecycleIndex).forEach(([key, value]) => {
            if (
              key.replaceAll("_", "").toLowerCase() ===
              request.lifecycle.toLowerCase()
            ) {
              lifecycle = value as RequestLifecycleIndex;
            }
          });
          return {
            requestId: Number(request.id),
            requestName: request.name,
            buyerId: Number(request.buyer_id),
            sellersPriceQuote: Number(request.seller_price_quote),
            lockedSellerId: Number(request.locked_seller_id),
            description: request.description,
            lifecycle: lifecycle,
            longitude: Number(request.location.longitude.toString()),
            latitude: Number(request.location.latitude.toString()),
            createdAt: Number(request.created_at.toString()),
            updatedAt: Number(request.updated_at.toString()),
            images: request.images,
          };
        });

        this.list = requests;
        return requests;
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
        const contract = await userStore.getContract();

        const result = await contract.execute(
          userStore.accountId!,
          env.contractId,
          {
            create_offer: {
              request_id: requestId,
              price: price.toString(),
              images: [...images],
              store_name: storeName,
            },
          },
          "auto"
        );

        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    async acceptOffer(offerId: number): Promise<any | undefined> {
      const userStore = useUserStore();
      try {
        const contract = await userStore.getContract();

        const result = await contract.execute(
          userStore.accountId!,
          env.contractId,
          {
            accept_offer: { offer_id: offerId },
          },
          "auto"
        );
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

        const queryResult = await contract.queryContractSmart(env.contractId, {
          get_offers_by_request: {
            request_id: requestId,
          },
        });
        const res: any = queryResult.map((offer: any) => {
          return {
            id: Number(offer.id),
            offerId: Number(offer.id),
            price: Number(offer.price),
            images: offer.images,
            requestId: offer.request_id,
            storeName: offer.store_name,
            sellerId: offer.seller_id,
            isAccepted: offer.is_accepted,
            createdAt: new Date(Number(offer.created_at)),
            updatedAt: new Date(Number(offer.updated_at)),
          };
        });

        return res;
      } catch (error) {
        console.log({ error });
        throw error;
      }
    },
    async markRequestAsCompleted(requestId: number) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();

        const result = await contract.execute(
          userStore.accountId!,
          env.contractId,
          {
            mark_request_as_completed: { request_id: requestId },
          },
          "auto"
        );

        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    async deleteRequest(requestId: number) {
      try {
        const userStore = useUserStore();
        const contract = await userStore.getContract();

        const result = await contract.execute(
          userStore.accountId!,
          env.contractId,
          {
            delete_request: { request_id: requestId },
          },
          "auto"
        );

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
