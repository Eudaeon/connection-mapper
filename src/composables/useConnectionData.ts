import { ref, computed, onMounted } from 'vue';
import { processLogFile } from '../services/logProcessor';
import { generateShareUrl, loadDataFromUrl } from '../services/shareService';
import { copyToClipboard } from '../utils/clipboard';
import type { UserMapData, LogEntry } from '../types/index';

const FILTERABLE_FIELDS: (keyof LogEntry)[] = [
  'application',
  'browser',
  'userAgent',
  'os',
  'managed',
  'compliant',
  'mfaRequirement',
  'mfaMethod',
];

const allUsers = ref<UserMapData[]>([]);
const isLoading = ref(false);
const statusMessage = ref('Upload a CSV log file to begin');
const errorMessage = ref('');
const showShareButton = ref(false);
const showCopiedMessage = ref(false);

const selectedUsers = ref(new Set<string>());
const minTimestamp = ref(0);
const maxTimestamp = ref(0);
const startRange = ref(0);
const endRange = ref(0);
const filterableCategories = ref<Map<string, Set<string>>>(new Map());
const selectedFilters = ref<Map<string, Set<string>>>(new Map());

function initializeFilters(data: UserMapData[]) {
  const discoveredCategories = new Map<string, Set<string>>();
  for (const user of data) {
    for (const conn of user.allConnections) {
      for (const field of FILTERABLE_FIELDS) {
        const value = conn[field];
        if (
          value !== undefined &&
          value !== null &&
          value !== '' &&
          typeof value === 'string'
        ) {
          if (!discoveredCategories.has(field)) {
            discoveredCategories.set(field, new Set());
          }
          discoveredCategories.get(field)!.add(value);
        }
      }
    }
  }

  const orderedCategories = new Map<string, Set<string>>();
  for (const field of FILTERABLE_FIELDS) {
    if (discoveredCategories.has(field)) {
      orderedCategories.set(field, discoveredCategories.get(field)!);
    }
  }

  filterableCategories.value = orderedCategories;
  selectedFilters.value = new Map(orderedCategories);
}

function initializeTimeline(data: UserMapData[]) {
  if (data.length === 0) {
    minTimestamp.value = 0;
    maxTimestamp.value = 0;
    startRange.value = 0;
    endRange.value = 0;
    return;
  }
  const allTimes = data.flatMap((u) =>
    u.allConnections.map((c) => c.timestamp.getTime())
  );
  if (allTimes.length === 0) {
    initializeTimeline([]);
    return;
  }
  minTimestamp.value = Math.min(...allTimes);
  maxTimestamp.value = Math.max(...allTimes);
  startRange.value = minTimestamp.value;
  endRange.value = maxTimestamp.value;
}

function passesCategoryFilters(conn: LogEntry): boolean {
  for (const [category, selectedSet] of selectedFilters.value.entries()) {
    const key = category as keyof LogEntry;
    const connValue = conn[key];
    if (connValue === undefined || connValue === null || connValue === '') {
      continue;
    }
    if (typeof connValue === 'string') {
      if (!selectedSet.has(connValue)) {
        return false;
      }
    }
  }
  return true;
}

function setData(processedData: UserMapData[]) {
  const sortedData = processedData.sort((a, b) => a.user.localeCompare(b.user));

  allUsers.value = sortedData;
  selectedUsers.value = new Set(sortedData.map((u) => u.user));
  initializeTimeline(sortedData);
  initializeFilters(sortedData);
  showShareButton.value = sortedData.length > 0;
}

const filteredUsers = computed(() => {
  if (allUsers.value.length === 0) return [];
  const filteredUsers: UserMapData[] = [];
  for (const user of allUsers.value) {
    if (!selectedUsers.value.has(user.user)) {
      continue;
    }
    const filteredConnections = user.allConnections.filter((conn) => {
      const time = conn.timestamp.getTime();
      const inTime = time >= startRange.value && time <= endRange.value;
      return inTime && passesCategoryFilters(conn);
    });
    if (filteredConnections.length > 0) {
      const latestConn = filteredConnections.reduce((latest, current) =>
        current.timestamp.getTime() > latest.timestamp.getTime()
          ? current
          : latest
      );
      filteredUsers.push({
        ...user,
        allConnections: filteredConnections,
        latestConnection: latestConn,
      });
    }
  }
  return filteredUsers;
});

const sliderFillStyle = computed(() => {
  if (maxTimestamp.value === minTimestamp.value) {
    return { left: '0%', right: '0%' };
  }
  const total = maxTimestamp.value - minTimestamp.value;
  const leftPercent = ((startRange.value - minTimestamp.value) / total) * 100;
  const rightPercent = ((endRange.value - minTimestamp.value) / total) * 100;
  return {
    left: `${leftPercent}%`,
    right: `${100 - rightPercent}%`,
  };
});

const allUsersSelected = computed(() => {
  if (allUsers.value.length === 0) {
    return false;
  }
  return selectedUsers.value.size === allUsers.value.length;
});

export function useConnectionData() {
  async function loadInitialData() {
    isLoading.value = true;
    statusMessage.value = 'Checking for shared map...';
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

    if (file) {
      isLoading.value = true;
      errorMessage.value = '';
      try {
        const processedData = await processLogFile(file, (message) => {
          statusMessage.value = message;
        });
        setData(processedData);
        statusMessage.value = `Successfully loaded ${processedData.length} users.`;
      } catch (e: any) {
        errorMessage.value = e.message || 'An unknown error occurred.';
        statusMessage.value = 'Upload a CSV log file to begin';
        setData([]);
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
      const url = await generateShareUrl(filteredUsers.value);
      copyToClipboard(url);
      showCopiedMessage.value = true;
      setTimeout(() => {
        showCopiedMessage.value = false;
      }, 2000);
    } catch (e: any) {
      console.error('Share map failed:', e);
      errorMessage.value = `Could not create share link: ${e.message}`;
    }
  }

  function toggleFilter(category: string, value: string) {
    const newSelectedFilters = new Map(selectedFilters.value);
    const currentSet = newSelectedFilters.get(category);
    if (currentSet) {
      const newSet = new Set(currentSet);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      newSelectedFilters.set(category, newSet);
      selectedFilters.value = newSelectedFilters;
    }
  }

  function onStartChange() {
    if (startRange.value > endRange.value) {
      endRange.value = startRange.value;
    }
  }
  function onEndChange() {
    if (endRange.value < startRange.value) {
      startRange.value = endRange.value;
    }
  }

  function toggleUser(username: string) {
    const newSet = new Set(selectedUsers.value);
    if (newSet.has(username)) {
      newSet.delete(username);
    } else {
      newSet.add(username);
    }
    selectedUsers.value = newSet;
  }

  function toggleSelectAll() {
    if (allUsersSelected.value) {
      selectedUsers.value = new Set();
    } else {
      selectedUsers.value = new Set(allUsers.value.map((u) => u.user));
    }
  }

  function formatDate(timestamp: number): string {
    if (timestamp === 0) return '---';
    return new Date(timestamp).toLocaleDateString();
  }

  onMounted(loadInitialData);

  return {
    allUsers,
    isLoading,
    statusMessage,
    errorMessage,
    showShareButton,
    showCopiedMessage,
    selectedUsers,
    minTimestamp,
    maxTimestamp,
    startRange,
    endRange,
    filterableCategories,
    selectedFilters,
    filteredUsers,
    sliderFillStyle,
    allUsersSelected,
    handleFileChange,
    shareMap,
    toggleFilter,
    onStartChange,
    onEndChange,
    toggleUser,
    toggleSelectAll,
    formatDate,
  };
}
