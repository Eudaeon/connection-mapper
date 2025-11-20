import { ref, computed, watch } from 'vue';
import type { LogEntry, UserMapData } from '../types/index';

const FILTERABLE_FIELDS: (keyof LogEntry)[] = [
  'application', 'browser', 'userAgent', 'os', 'managed', 'compliant', 'mfaRequirement', 'mfaMethod',
];

const selectedFilters = ref<Map<string, Set<string>>>(new Map());

export function useFilters(allUsers: { value: UserMapData[] }, selectedUsers: { value: Set<string> }) {
  const filterableCategories = computed(() => {
    const discoveredCategories = new Map<string, Set<string>>();
    const activeUsers = allUsers.value.filter((u) => selectedUsers.value.has(u.user));

    for (const user of activeUsers) {
      for (const conn of user.allConnections) {
        for (const field of FILTERABLE_FIELDS) {
          const value = conn[field];
          if (value && typeof value === 'string') {
            if (!discoveredCategories.has(field)) discoveredCategories.set(field, new Set());
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
    return orderedCategories;
  });

  watch(filterableCategories, (newCategories, oldCategories) => {
    const newSelectedFilters = new Map(selectedFilters.value);
    for (const [category, newValues] of newCategories) {
      const oldValues = oldCategories?.get(category);
      const currentSelection = newSelectedFilters.get(category);
      
      const wasAllSelected = !currentSelection || (oldValues && currentSelection.size === oldValues.size);

      if (wasAllSelected) {
        newSelectedFilters.set(category, new Set(newValues));
      } else {
        const preserved = new Set<string>();
        if (currentSelection) {
          for (const val of currentSelection) {
            if (newValues.has(val)) preserved.add(val);
          }
        }
        newSelectedFilters.set(category, preserved);
      }
    }
    for (const category of newSelectedFilters.keys()) {
      if (!newCategories.has(category)) newSelectedFilters.delete(category);
    }
    selectedFilters.value = newSelectedFilters;
  }, { immediate: true });

  function passesCategoryFilters(conn: LogEntry): boolean {
    for (const [category, selectedSet] of selectedFilters.value.entries()) {
      const key = category as keyof LogEntry;
      const connValue = conn[key];
      if (connValue && typeof connValue === 'string') {
        if (!selectedSet.has(connValue)) return false;
      }
    }
    return true;
  }

  function toggleFilter(category: string, value: string) {
    const newMap = new Map(selectedFilters.value);
    const set = new Set(newMap.get(category));
    if (set.has(value)) set.delete(value);
    else set.add(value);
    newMap.set(category, set);
    selectedFilters.value = newMap;
  }

  function toggleSelectAllFilterCategory(category: string) {
    const newMap = new Map(selectedFilters.value);
    const all = filterableCategories.value.get(category);
    const current = selectedFilters.value.get(category);
    if (!all || !current) return;

    newMap.set(category, current.size === all.size ? new Set() : new Set(all));
    selectedFilters.value = newMap;
  }

  return { selectedFilters, filterableCategories, passesCategoryFilters, toggleFilter, toggleSelectAllFilterCategory };
}