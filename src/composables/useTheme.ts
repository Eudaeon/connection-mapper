import { ref, watchEffect, onMounted } from 'vue';

const isDarkMode = ref(false);

export function useTheme() {
  function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      isDarkMode.value = savedTheme === 'dark';
    } else {
      isDarkMode.value =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
  }

  watchEffect(() => {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  });

  onMounted(() => {
    initializeTheme();
  });

  return {
    isDarkMode,
    toggleDarkMode,
  };
}
