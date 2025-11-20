import { ref, computed, onMounted } from 'vue';
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
  const filters = useFilters(allUsers, selectedUsers);

  const filteredUsers = computed(() => {
    if (allUsers.value.length === 0) return [];
    
    const result: UserMapData[] = [];
    
    for (const user of allUsers.value) {
      if (!selectedUsers.value.has(user.user)) continue;

      const filteredConnections = user.allConnections.filter((conn) => {
        const time = conn.timestamp.getTime();
        const inTime = time >= timeline.startRange.value && time <= timeline.endRange.value;
        return inTime && filters.passesCategoryFilters(conn);
      });

      if (filteredConnections.length > 0) {
        const latestConn = filteredConnections.reduce((latest, current) =>
          current.timestamp.getTime() > latest.timestamp.getTime()
            ? current
            : latest
        );
        result.push({
          ...user,
          allConnections: filteredConnections,
          latestConnection: latestConn,
        });
      }
    }
    return result;
  });

  const allUsersSelected = computed(() => {
    return allUsers.value.length > 0 && selectedUsers.value.size === allUsers.value.length;
  });

  function setData(processedData: UserMapData[]) {
    const sortedData = processedData.sort((a, b) => a.user.localeCompare(b.user));
    allUsers.value = sortedData;
    selectedUsers.value = new Set(sortedData.map((u) => u.user));
    
    const allTimes = sortedData.flatMap((u) =>
      u.allConnections.map((c) => c.timestamp.getTime())
    );
    timeline.setTimelineBounds(allTimes);
    
    showShareButton.value = sortedData.length > 0;
  }

  async function loadInitialData() {
    isLoading.value = true;
    statusMessage.value = 'Checking for shared map...';
    progressValue.value = 0;
    progressText.value = '';
    
    try {
      const hydratedData = await loadDataFromUrl();
      if (hydratedData) {
        setData(hydratedData);
        statusMessage.value = `Successfully loaded shared map for ${hydratedData.length} users.`;
      } else {
        statusMessage.value = 'Upload a CSV log file to begin';
      }
    } catch (e: any) {
      errorMessage.value = e.message;
      statusMessage.value = 'Upload a CSV log file to begin';
    } finally {
      isLoading.value = false;
    }
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    isLoading.value = true;
    errorMessage.value = '';
    progressValue.value = 0;
    progressText.value = '';

    const progressReporter = (msg: string, val = 0, txt = '') => {
      statusMessage.value = msg;
      progressValue.value = val;
      progressText.value = txt;
    };

    try {
      const processedData = await processLogFile(file, progressReporter);
      setData(processedData);
      statusMessage.value = `Successfully loaded ${processedData.length} users.`;
    } catch (e: any) {
      errorMessage.value = e.message || 'An unknown error occurred.';
      statusMessage.value = 'Upload a CSV log file to begin';
      setData([]);
    } finally {
      isLoading.value = false;
      target.value = '';
    }
  }

  async function shareMap() {
    try {
      const url = await generateShareUrl(filteredUsers.value);
      copyToClipboard(url);
      showCopiedMessage.value = true;
      setTimeout(() => showCopiedMessage.value = false, 2000);
    } catch (e: any) {
      console.error('Share map failed:', e);
      errorMessage.value = `Could not create share link: ${e.message}`;
    }
  }

  function toggleUser(username: string) {
    const newSet = new Set(selectedUsers.value);
    if (newSet.has(username)) newSet.delete(username);
    else newSet.add(username);
    selectedUsers.value = newSet;
  }

  function toggleSelectAll() {
    selectedUsers.value = allUsersSelected.value 
      ? new Set() 
      : new Set(allUsers.value.map((u) => u.user));
  }

  onMounted(loadInitialData);

  return {
    allUsers,
    selectedUsers,
    filteredUsers,
    isLoading,
    statusMessage,
    errorMessage,
    showShareButton,
    showCopiedMessage,
    progressValue,
    progressText,
    allUsersSelected,

    minTimestamp: timeline.minTimestamp,
    maxTimestamp: timeline.maxTimestamp,
    roundedMinTimestamp: timeline.roundedMinTimestamp,
    roundedMaxTimestamp: timeline.roundedMaxTimestamp,
    startRange: timeline.startRange,
    endRange: timeline.endRange,
    snapStep: timeline.snapStep,
    sliderFillStyle: timeline.sliderFillStyle,
    formatDate: timeline.formatDate,
    onStartChange: timeline.onStartChange,
    onEndChange: timeline.onEndChange,

    filterableCategories: filters.filterableCategories,
    selectedFilters: filters.selectedFilters,
    toggleFilter: filters.toggleFilter,
    toggleSelectAllFilterCategory: filters.toggleSelectAllFilterCategory,

    handleFileChange,
    shareMap,
    toggleUser,
    toggleSelectAll,
  };
}