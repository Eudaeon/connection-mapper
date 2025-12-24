import { ref, computed } from 'vue';
import { processLogFile } from '../services/logProcessor';
import { generateShareUrl, loadDataFromUrl } from '../services/shareService';
import { copyToClipboard } from '../utils/clipboard';
import type { UserMapData } from '../types/index';
import { useTimeline } from './useTimeline';
import { useFilters } from './useFilters';

const allUsers = ref<UserMapData[]>([]);
const selectedUsers = ref(new Set<string>());
const isLoading = ref(false);
const statusMessage = ref('Upload a CSV log file to begin');
const errorMessage = ref('');
const showShareButton = ref(false);
const showCopiedMessage = ref(false);
const progressValue = ref(0);
const progressText = ref('');

export function useConnectionData() {
  const timeline = useTimeline();
  const filters = useFilters(allUsers, selectedUsers, timeline.startRange, timeline.endRange);

  const filteredUsers = computed(() => {
    if (allUsers.value.length === 0) return [];
    const start = timeline.startRange.value;
    const end = timeline.endRange.value;
    const activeUsers = selectedUsers.value;

    return allUsers.value.reduce((acc, user) => {
      if (!activeUsers.has(user.user)) return acc;

      const filtered = user.allConnections.filter((conn) => {
        const time = conn.timestamp.getTime();
        return time >= start && time <= end && filters.passesCategoryFilters(conn);
      });

      if (filtered.length > 0) {
        acc.push({ 
          ...user, 
          allConnections: filtered, 
          latestConnection: filtered[filtered.length - 1] 
        });
      }
      return acc;
    }, [] as UserMapData[]);
  });

  const allUsersSelected = computed(() => allUsers.value.length > 0 && selectedUsers.value.size === allUsers.value.length);

  function setData(processedData: UserMapData[]) {
    const sortedData = processedData.sort((a, b) => a.user.localeCompare(b.user));
    allUsers.value = sortedData;
    selectedUsers.value = new Set(sortedData.map(u => u.user));
    const allTimes = sortedData.flatMap(u => u.allConnections.map(c => c.timestamp.getTime()));
    timeline.setTimelineBounds(allTimes);
    showShareButton.value = sortedData.length > 0;
  }

  async function loadInitialData() {
    isLoading.value = true;
    try {
      const hydratedData = await loadDataFromUrl();
      if (hydratedData) setData(hydratedData);
    } catch (e: any) {
      errorMessage.value = e.message;
    } finally {
      isLoading.value = false;
    }
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    filters.clearFilters();
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const processedData = await processLogFile(file, (msg, val = 0, txt = '') => {
        statusMessage.value = msg; 
        progressValue.value = val; 
        progressText.value = txt;
      });
      setData(processedData);
    } catch (e: any) {
      errorMessage.value = e.message || 'An unknown error occurred.';
      setData([]);
    } finally {
      isLoading.value = false; 
      target.value = '';
    }
  }

  return {
    allUsers, selectedUsers, filteredUsers, isLoading, statusMessage, errorMessage, 
    showShareButton, showCopiedMessage, progressValue, progressText, allUsersSelected,
    loadInitialData,
    startRange: timeline.startRange, endRange: timeline.endRange,
    roundedMinTimestamp: timeline.roundedMinTimestamp, roundedMaxTimestamp: timeline.roundedMaxTimestamp,
    snapStep: timeline.snapStep, formatDate: timeline.formatDate,
    filterableCategories: filters.filterableCategories, applicableCounts: filters.applicableCounts,
    userMatchCounts: filters.userMatchCounts, selectedFilters: filters.selectedFilters,
    toggleFilter: filters.toggleFilter, toggleSelectAllFilterCategory: filters.toggleSelectAllFilterCategory,
    handleFileChange, shareMap: async () => {
      try { 
        const url = generateShareUrl(filteredUsers.value); 
        copyToClipboard(url); 
        showCopiedMessage.value = true; 
        setTimeout(() => showCopiedMessage.value = false, 2000); 
      }
      catch (e: any) { errorMessage.value = `Share link failed: ${e.message}`; }
    },
    toggleUser: (user: string) => { 
      const n = new Set(selectedUsers.value); 
      if (n.has(user)) n.delete(user); else n.add(user); 
      selectedUsers.value = n; 
    },
    toggleSelectAll: () => { 
      selectedUsers.value = allUsersSelected.value ? new Set() : new Set(allUsers.value.map(u => u.user)); 
    },
  };
}