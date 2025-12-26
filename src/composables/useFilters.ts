import { ref, computed, watch, type Ref } from 'vue';
import type { LogEntry, UserMapData } from '../types/index';

const FILTERABLE_FIELDS: (keyof LogEntry)[] = [
  'ip',
  'status',
  'reason',
  'application',
  'browser',
  'userAgent',
  'os',
  'managed',
  'compliant',
  'mfaRequirement',
  'mfaMethod',
];

const selectedFilters = ref<Map<string, Set<string>>>(new Map());

export function useFilters(
  allUsers: Ref<UserMapData[]>,
  selectedUsers: Ref<Set<string>>,
  startRange: Ref<number>,
  endRange: Ref<number>
) {
  const baseConnections = computed(() => {
    const result: LogEntry[] = [];
    const start = startRange.value;
    const end = endRange.value;
    const activeUsers = selectedUsers.value;

    for (const userData of allUsers.value) {
      if (!activeUsers.has(userData.user)) continue;

      for (const conn of userData.allConnections) {
        const time = conn.timestamp.getTime();
        if (time >= start && time <= end) {
          result.push(conn);
        }
      }
    }
    return result;
  });

  const filterableCategories = computed(() => {
    const discovered = new Map<string, Set<string>>();
    for (const conn of baseConnections.value) {
      for (const field of FILTERABLE_FIELDS) {
        const val = conn[field];
        if (val && typeof val === 'string') {
          if (!discovered.has(field)) discovered.set(field, new Set());
          discovered.get(field)!.add(val);
        }
      }
    }

    const ordered = new Map<string, Set<string>>();
    for (const field of FILTERABLE_FIELDS) {
      if (discovered.has(field)) {
        const values = discovered.get(field)!;
        if (values.size <= 1) continue;
        ordered.set(field, values);
      }
    }
    return ordered;
  });

  const applicableCounts = computed(() => {
    const categoryCounts = new Map<string, Map<string, number>>();
    const userCounts = new Map<string, number>();
    const connections = baseConnections.value;
    const currentFilters = selectedFilters.value;

    const updateMapCount = (cat: string, val: string) => {
      if (!categoryCounts.has(cat)) categoryCounts.set(cat, new Map());
      const m = categoryCounts.get(cat)!;
      m.set(val, (m.get(val) || 0) + 1);
    };

    const incrementAllFields = (conn: LogEntry) => {
      for (const field of FILTERABLE_FIELDS) {
        const val = conn[field];
        if (typeof val === 'string') updateMapCount(field, val);
      }
    };

    for (const conn of connections) {
      let failedCategories: string[] = [];

      for (const [cat, set] of currentFilters.entries()) {
        const val = conn[cat as keyof LogEntry];
        if (val && typeof val === 'string' && !set.has(val)) {
          failedCategories.push(cat);
        }
      }

      const failCount = failedCategories.length;

      if (failCount === 0) {
        incrementAllFields(conn);
        userCounts.set(conn.user, (userCounts.get(conn.user) || 0) + 1);
      } else if (failCount === 1) {
        const failedCat = failedCategories[0]!;
        const val = conn[failedCat as keyof LogEntry];
        if (typeof val === 'string') updateMapCount(failedCat, val);
        userCounts.set(conn.user, (userCounts.get(conn.user) || 0) + 1);
      }
    }

    return { categories: categoryCounts, users: userCounts };
  });

  watch(
    filterableCategories,
    (newCats, oldCats) => {
      const newSelected = new Map(selectedFilters.value);
      let changed = false;

      for (const [cat, newVals] of newCats) {
        const oldVals = oldCats?.get(cat);
        const current = newSelected.get(cat);

        if (!current) {
          newSelected.set(cat, new Set(newVals));
          changed = true;
          continue;
        }

        const wasAllSelected = oldVals && current.size === oldVals.size;

        if (wasAllSelected) {
          if (
            current.size !== newVals.size ||
            ![...newVals].every((v) => current.has(v))
          ) {
            newSelected.set(cat, new Set(newVals));
            changed = true;
          }
        } else {
          const pruned = new Set([...current].filter((v) => newVals.has(v)));
          if (pruned.size !== current.size) {
            newSelected.set(cat, pruned);
            changed = true;
          }
        }
      }

      if (changed) selectedFilters.value = newSelected;
    },
    { immediate: true, deep: true }
  );

  function clearFilters() {
    selectedFilters.value = new Map();
  }

  function passesCategoryFilters(conn: LogEntry): boolean {
    for (const [category, selectedSet] of selectedFilters.value.entries()) {
      const val = conn[category as keyof LogEntry];
      if (val && typeof val === 'string' && !selectedSet.has(val)) return false;
    }
    return true;
  }

  function toggleFilter(category: string, value: string) {
    const newMap = new Map(selectedFilters.value);
    const set = new Set(newMap.get(category) || []);
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

  return {
    selectedFilters,
    filterableCategories,
    applicableCounts: computed(() => applicableCounts.value.categories),
    userMatchCounts: computed(() => applicableCounts.value.users),
    passesCategoryFilters,
    toggleFilter,
    toggleSelectAllFilterCategory,
    clearFilters,
  };
}
