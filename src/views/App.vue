<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useConnectionData } from '../composables/useConnectionData';
import ConnectionMap from '../components/ConnectionMap.vue';
import ControlPanel from '../components/ControlPanel.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import UserPanel from '../components/UserPanel.vue';
import FilterPanel from '../components/FilterPanel.vue';
import TimelinePanel from '../components/TimelinePanel.vue';
import ProgressRing from '../components/ProgressRing.vue';

const { filteredUsers, isLoading, statusMessage, progressValue, progressText, errorMessage } =
  useConnectionData();

function clearError() {
  errorMessage.value = '';
}

onMounted(() => {
  const onErr = (e: Event | ErrorEvent) => {
    const msg = (e && (e as any).message) || 'An unexpected error occurred.';
    errorMessage.value = msg;
  };

  const onRejection = (ev: PromiseRejectionEvent) => {
    const reason = ev?.reason;
    errorMessage.value = (reason && reason.message) || String(reason) || 'An unexpected promise rejection occurred.';
  };

  window.addEventListener('error', onErr as EventListener);
  window.addEventListener('unhandledrejection', onRejection as EventListener);

  const onConsoleError = (ev: Event) => {
    const detail = (ev as CustomEvent)?.detail;
    const msg = detail?.message || 'An error was logged to console.';
    errorMessage.value = msg;
  };

  window.addEventListener('app:console-error', onConsoleError as EventListener);

  onUnmounted(() => {
    window.removeEventListener('error', onErr as EventListener);
    window.removeEventListener('unhandledrejection', onRejection as EventListener);
    window.removeEventListener('app:console-error', onConsoleError as EventListener);
  });
});
</script>

<template>
  <div id="app-container">
    <ConnectionMap :users="filteredUsers" />
    <ControlPanel />
    <ThemeToggle />
    <UserPanel />
    <FilterPanel />
    <TimelinePanel />

    <div v-if="isLoading" class="loading-overlay">
      <div class="loader-content">
        <ProgressRing
          :value="progressValue"
          :text="progressText"
          :size="80"
          :stroke-width="6"
        />
        <span class="loading-status">{{ statusMessage }}</span>
      </div>
    </div>

    <div v-if="errorMessage" class="loading-overlay error-overlay">
      <div class="loader-content" :style="{ '--color-slider-fill': 'var(--color-error)' }">
        <ProgressRing :value="100" :text="'!'" :size="80" :stroke-width="6" />
        <div class="error-content">
          <div class="error-text">{{ errorMessage }}</div>
          <button class="error-close" @click="clearError">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#app-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  backdrop-filter: blur(4px);
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  background-color: var(--color-panel-bg);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px var(--color-panel-shadow);
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: 420px;
}

.error-text {
  color: var(--color-text);
  font-weight: 600;
  text-align: center;
  word-break: break-word;
}

.error-close {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  background-color: var(--color-error);
  color: white;
  cursor: pointer;
}

.loading-status {
  font-weight: 500;
  color: var(--color-text);
}
</style>
