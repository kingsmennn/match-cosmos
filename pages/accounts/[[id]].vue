<template>
  <div class="tw-max-w-7xl tw-mx-auto">
    <div class="tw-p-6 sm:tw-p-10">
      <FinalizeRegistration
        v-if="!userStore.passedSecondaryCheck && (locationEnabled || isSeller)"
        class="tw-mb-6"
      />

      <div class="tw-mb-6 tw-flex tw-justify-between tw-items-center">
        <div
          class="tw-h-16 tw-w-16 tw-rounded-full tw-bg-gray-100 tw-text-4xl tw-font-black
          tw-flex tw-items-center tw-justify-center tw-select-none">
          {{ userInitial }}
        </div>

        <button
          v-if="isBuyer"
          @click="handleRequestForItem"
          class="tw-inline-block tw-p-4 tw-px-6 tw-rounded-full tw-bg-black
          tw-select-none tw-text-white hover:tw-bg-black/80
          tw-transition-all tw-duration-300 tw-font-black">
          Request for an item
        </button>
      </div>
      
      <div>
        <Tabs
          :tab_list="tab_list"
          :value="tab"
          @model-value="($event) => tab = $event"
          class="tw-inline-flex tw-gap-x-1 sm:tw-gap-x-2 tw-justify-between
          tw-rounded-sm tw-w-full [&>*]:tw-flex-grow [&>*]:tw-max-w-[50%]">
          <template v-slot:tab="{ tab, index: i, is_active }">
            <div
              :class="[is_active ? 'tw-border-black' : 'tw-text-gray-400 tw-border-transparent']"
              class="tw-border-b-4 tw-py-2 tw-transition tw-duration-300 tw-font-medium tw-cursor-pointer">
              <span class="tw-flex tw-flex-col tw-items-center">
                <v-icon>{{ (tab as any)?.icon }}</v-icon>
                <span>{{ (tab as any)?.name }}</span>
              </span>
            </div>
          </template>
        </Tabs>

        <div class="tw-mt-6">
          <div v-show="tab===tab_list[0].slug" class="tw-grid sm:tw-grid-cols-2 tw-gap-3">
            <RequestItem
              v-for="request in activeRequestList" :key="request._id"
              :requestId="request.requestId"
              :lifecycle="request.lifecycle"
              :itemName="request.requestName"
              :thumbnail="request.images[0]"
              :created-at="new Date(request.createdAt * 1000)"
              :updated-at="new Date(request.updatedAt * 1000)"
              :buyerId="request.buyerAddress"
              :buyer-address="request.buyerAddress!"
              :lockedSellerId="request.lockedSellerId ?? null"
              :sellers-price-quote="request.sellersPriceQuote ?? null"
              :account-type="userStore.accountType!"
            />
          </div>
          
          <div v-show="tab===tab_list[1].slug" class="tw-grid tw-gap-3">
            <RequestItem
              v-for="request in completedRequestList" :key="request._id"
              :requestId="request.requestId"
              :lifecycle="request.lifecycle"
              :itemName="request.requestName"
              :thumbnail="request.images[0]"
              :created-at="new Date(request.createdAt * 1000)"
              :updated-at="new Date(request.updatedAt * 1000)"
              :buyerId="request.buyerAddress"
              :buyer-address="request.buyerAddress!"
              :lockedSellerId="request.lockedSellerId ?? null"
              :sellers-price-quote="request.sellersPriceQuote ?? null"
              :account-type="userStore.accountType!"
              is-completed
            />
          </div>

          <!-- show empty state UI when either tab has no content -->
          <div
            v-show="(tab===tab_list[0].slug && activeRequestList.length===0) || (tab===tab_list[1].slug && completedRequestList.length===0)"
            class="tw-p-6 tw-py-10 tw-text-center tw-border-4 tw-border-gray-400/5 tw-rounded-2xl
            tw-bg-gray-300/5 tw-my-10 tw-text-2xl tw-text-gray-500">
            <p>All {{ tab }} requests will be listed here...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FinalizeRegistration from '@/components/FinalizeRegistration.vue'
import Tabs from '@/components/Tabs.vue';
import RequestItem from '@/components/RequestItem.vue';
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { RequestLifecycle, AccountType, User, Request, Offer, RequestLifecycleIndex } from '@/types'
import { useUserStore } from '@/pinia/user';
import { useRequestsStore } from '@/pinia/request';
import { toast } from 'vue-sonner';
import { locationRequired_buyer } from '@/utils/messages';

const env = useRuntimeConfig().public
useHead({
  title: env.appName+' - Your account',
})
definePageMeta({
  middleware: 'auth',
  requiresAuth: true,
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const userInitial = computed(() => userStore?.username?.charAt(0).toUpperCase() ?? '?')
const isSeller = computed(() => userStore.accountType === AccountType.SELLER)
const isBuyer = computed(() => userStore.accountType === AccountType.BUYER)
const locationEnabled = computed(() => userStore.locationEnabled)

const tab = ref()
const tab_list = ref<{ name: string, slug: string, icon: string }[]>([])
onBeforeMount(()=>{
  if (isSeller.value) {
    tab_list.value = [
      { name: 'Accepted requests', slug: 'accepted', icon: 'mdi-timelapse' },
      { name: 'Requests I fulfilled', slug: 'fulfilled', icon: 'mdi-cube-send' },
    ]
    return
  }

  tab_list.value = [
    { name: 'Active requests', slug: 'active', icon: 'mdi-timelapse' },
    { name: 'Completed requests', slug: 'completed', icon: 'mdi-cube-send' },
  ]
})

const handleRequestForItem = () => {
  // check if user needs to provide their location before creating a request
  if(!locationEnabled.value || userStore.passedSecondaryCheck) {
    router.push('/requests/create')
    return
  }
  toast.info(locationRequired_buyer)
}

const requestsStore = useRequestsStore()
const handleFetchRequests = async (accountId:string) => {
  if (isSeller.value) {
    requestsStore.fetchAllSellersRequests(accountId)
    return
  }
  requestsStore.fetchAllUserRequests(accountId)
}
onMounted(()=>{handleFetchRequests(userStore.accountId!)})

const activeRequestList = computed(() => {
  // if (isSeller.value) {
  //   // return sellerRequestList.value.filter(request => request.lifecycle !== RequestLifecycle.COMPLETED).reverse()
  // }
  return requestsStore.list.filter(request=>{
    return request.lifecycle !== RequestLifecycleIndex.COMPLETED
  })
})

const completedRequestList = computed(() => {
  // if (isSeller.value) {
  //   // return sellerRequestList.value.filter(request => request.lifecycle === RequestLifecycle.COMPLETED).reverse()
  // }
  return requestsStore.list.filter(request=>{
    return request.lifecycle === RequestLifecycleIndex.COMPLETED
  })
})

// update users accountId in route when the selected account changes
watch(() => userStore.accountId, async (val) => {
  if (!val) return
  router.replace(`/accounts/${val}`)
  await new Promise(resolve => setTimeout(resolve, 500))
  handleFetchRequests(val)
})
</script>