<script setup lang="ts">
import { useTheme } from '../composables/useTheme';
import { Sun, Moon } from 'lucide-vue-next';

const { isDarkMode, toggleDarkMode } = useTheme();
</script>

<template>
  <div id="theme-toggle" class="floating-panel">
    <button title="Toggle Theme" class="control-button" @click="toggleDarkMode">
      <Sun v-if="isDarkMode" :size="20" />
      <Moon v-else :size="20" />
    </button>
  </div>
</template>
<style scoped>
#theme-toggle {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.control-button {
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: var(--color-button-text);
  transition: background-color 0.2s;
  background: none;
  border: none;
  line-height: 0;
}
.control-button:hover {
  background-color: var(--color-button-hover-bg);
  cursor: pointer;
}
</style>
