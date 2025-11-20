<script setup lang="ts">
import { useConnectionData } from '../composables/useConnectionData';
import { FileUp, Share2 } from 'lucide-vue-next';

const {
  isLoading,
  showShareButton,
  showCopiedMessage,
  handleFileChange,
  shareMap,
} = useConnectionData();
</script>

<template>
  <div id="control-panel" class="floating-panel">
    <label
      for="file-upload"
      title="Load CSV"
      :class="['control-button', isLoading ? 'disabled' : '']"
    >
      <FileUp :size="20" />
    </label>
    <input
      id="file-upload"
      type="file"
      accept=".csv"
      :disabled="isLoading"
      @change="handleFileChange"
    />
    <button
      v-if="showShareButton && !isLoading"
      title="Share Map"
      class="control-button"
      @click="shareMap"
    >
      <Share2 :size="20" />
      <transition
        enter-active-class="transition-opacity duration-300"
        leave-active-class="transition-opacity duration-500"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <span v-if="showCopiedMessage" class="copied-message">Copied!</span>
      </transition>
    </button>
  </div>
</template>

<style scoped>
#control-panel {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem;
  display: flex;
  gap: 0.5rem;
}

.control-button {
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: var(--color-button-text);
  transition: background-color 0.2s;
  background: none;
  border: none;
  line-height: 0;
  position: relative;
}
.control-button:hover {
  background-color: var(--color-button-hover-bg);
  cursor: pointer;
}
label.control-button {
  cursor: pointer;
}
.control-button.disabled,
label.control-button.disabled {
  cursor: not-allowed;
  opacity: 0.5;
  color: var(--color-button-disabled-text);
}

#file-upload {
  display: none;
}

.copied-message {
  position: absolute;
  top: 100%;
  margin-top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-popup-bg);
  color: var(--color-text);
  font-size: 0.875rem;
  line-height: 1.5;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  box-shadow:
    0 4px 6px -1px var(--color-panel-shadow),
    0 2px 4px -2px var(--color-panel-shadow);
  white-space: nowrap;
  pointer-events: none;
  z-index: 20;
}

.transition-opacity {
  transition-property: opacity;
}
.duration-300 {
  transition-duration: 300ms;
}
.duration-500 {
  transition-duration: 500ms;
}
.opacity-0 {
  opacity: 0;
}
</style>
