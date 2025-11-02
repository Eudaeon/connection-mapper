<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ConnectionMap from './components/ConnectionMap.vue';
import { processLogFile } from './services/logProcessor';
import { generateShareUrl, loadDataFromUrl } from './services/shareService';
import { copyToClipboard } from './utils/clipboard';
import type { UserMapData } from './types';
import { FileUp, Share2 } from 'lucide-vue-next';

const users = ref<UserMapData[]>([]);
const isLoading = ref(false);
const statusMessage = ref('Upload a CSV log file to begin');
const errorMessage = ref('');
const showShareButton = ref(false);
const showCopiedMessage = ref(false);

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const processedData = await processLogFile(file, (message) => {
        statusMessage.value = message;
      });
      users.value = processedData;
      showShareButton.value = true;
      statusMessage.value = `Successfully loaded ${processedData.length} users.`;
    } catch (e: any) {
      errorMessage.value = e.message || 'An unknown error occurred.';
      statusMessage.value = 'Upload a CSV log file to begin';
    } finally {
      isLoading.value = false;
    }
  }
  
  if (target) {
    target.value = '';
  }
}

async function shareMap() {
  try {
    const url = await generateShareUrl(users.value);
    copyToClipboard(url);
    
    showCopiedMessage.value = true;
    setTimeout(() => {
      showCopiedMessage.value = false;
    }, 2000);

  } catch (e: any) {
    console.error("Share map failed:", e);
    errorMessage.value = `Could not create share link: ${e.message}`;
  }
}

onMounted(async () => {
  isLoading.value = true;
  statusMessage.value = 'Checking for shared map...';
  try {
    const hydratedData = await loadDataFromUrl();
    if (hydratedData) {
      users.value = hydratedData;
      showShareButton.value = true;
      statusMessage.value = `Successfully loaded shared map for ${hydratedData.length} users.`;
    } else {
      statusMessage.value = 'Upload a CSV log file to begin';
    }
  } catch(e: any) {
    errorMessage.value = e.message;
    statusMessage.value = 'Upload a CSV log file to begin';
  } finally {
    isLoading.value = false;
  }
});

</script>

<template>
  <div class="w-full h-full relative">
    <ConnectionMap :users="users" />

    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-800 bg-opacity-80 backdrop-blur-sm p-2 rounded-lg shadow-lg flex gap-2">
      <label 
        for="file-upload" 
        title="Load CSV"
        :class="[
          'p-2 rounded-md transition-colors',
          isLoading 
            ? 'cursor-not-allowed opacity-50 text-gray-500' 
            : 'text-white-400 hover:bg-gray-700 hover:text-white-300 cursor-pointer'
        ]"
      >
        <FileUp :size="20" />
      </label>
      <input 
        id="file-upload" 
        type="file" 
        @change="onFileChange" 
        accept=".csv"
        :disabled="isLoading"
        class="hidden"
      />

      <button 
        v-if="showShareButton && !isLoading"
        @click="shareMap"
        title="Share Map"
        class="p-2 rounded-md text-white-400 hover:bg-gray-700 hover:text-white-300 transition-colors relative"
      >
        <Share2 :size="20" />
        
        <transition
          enter-active-class="transition-opacity duration-300"
          leave-active-class="transition-opacity duration-500"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <div v-if="showCopiedMessage" class="absolute top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm py-1 px-3 rounded-md shadow-lg whitespace-nowrap">
            Copied!
          </div>
        </transition>
      </button>
    </div>
    
  </div>
</template>

<style>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
