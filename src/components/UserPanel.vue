<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConnectionData } from '../composables/useConnectionData';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const {
  allUsers,
  selectedUsers,
  userMatchCounts,
  toggleUser,
  allUsersSelected,
  toggleSelectAll,
} = useConnectionData();
const isUserPanelCollapsed = ref(true);

const isPartiallySelected = computed(() => {
  if (allUsers.value.length === 0) return false;
  return !allUsersSelected.value && selectedUsers.value.size > 0;
});

function getMatchCount(username: string): number {
  return userMatchCounts.value.get(username) || 0;
}

function isMuted(username: string): boolean {
  const isSelected = selectedUsers.value.has(username);
  const isApplicable = getMatchCount(username) > 0;
  return !isSelected || !isApplicable;
}
</script>

<template>
  <div v-if="allUsers.length > 1" id="user-panel-wrapper">
    <button
      class="collapse-toggle collapse-toggle-right"
      title="Toggle User Panel"
      @click="isUserPanelCollapsed = !isUserPanelCollapsed"
    >
      <ChevronLeft v-if="!isUserPanelCollapsed" :size="20" />
      <ChevronRight v-else :size="20" />
    </button>

    <div
      v-if="!isUserPanelCollapsed"
      id="user-panel"
      v-motion
      class="floating-panel"
      :initial="{ opacity: 0, x: -50 }"
      :enter="{
        opacity: 1,
        x: 0,
        transition: { type: 'spring', stiffness: 300, damping: 30 },
      }"
      :leave="{ opacity: 0, x: -50, transition: { duration: 150 } }"
    >
      <div class="panel-content">
        <h4>Users</h4>
        <div class="select-all-container">
          <input
            id="select-all-users"
            type="checkbox"
            :checked="allUsersSelected"
            :indeterminate.prop="isPartiallySelected"
            @click="toggleSelectAll"
          />
          <label for="select-all-users" title="Select/Deselect All Users">
            Select All <span>({{ selectedUsers.size }})</span>
          </label>
        </div>
        <ul class="user-list">
          <li
            v-for="user in allUsers"
            :key="user.user"
            class="user-item"
            :class="{ 'is-muted': isMuted(user.user) }"
          >
            <input
              :id="`user-${user.user}`"
              type="checkbox"
              :checked="selectedUsers.has(user.user)"
              @change="toggleUser(user.user)"
            />
            <span
              class="color-swatch"
              :style="{ backgroundColor: user.color }"
            ></span>
            <label :for="`user-${user.user}`" :title="user.user">
              {{ user.user }}
              <span class="match-count">({{ getMatchCount(user.user) }})</span>
            </label>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
#user-panel-wrapper {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
}

#user-panel {
  padding: 0.5rem 0.75rem;
  width: 280px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.panel-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-grow: 1;
  min-height: 0;
}

h4 {
  margin: 0 0 0.5rem 0;
  padding: 0.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0;
  text-align: center;
}

.select-all-container {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px dashed var(--color-border);
  padding-bottom: 0.5rem;
  margin-bottom: 5px;
}
.select-all-container label {
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: normal;
  word-break: break-word;
}
.select-all-container label span {
  font-weight: 500;
  color: var(--color-text-muted);
}
.select-all-container input[type='checkbox'] {
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 4px;
}

.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex-grow: 1;
}

.user-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
  content-visibility: auto;
  contain-intrinsic-size: 0 28px;
  transition: opacity 0.2s;
}

.user-item.is-muted {
  opacity: 0.45;
}

.match-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
  font-weight: 400;
}

.color-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  margin-top: 6px;
}

.user-item label {
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  white-space: normal;
  word-break: break-word;
}
.user-item input[type='checkbox'] {
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 4px;
}

.collapse-toggle {
  position: absolute;
  z-index: 11;
  width: 24px;
  height: 80px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 0;
  color: var(--color-button-text);
  transition: background-color 0.2s;
  background-color: var(--color-panel-bg);
  backdrop-filter: blur(4px);
  border: none;
  box-shadow: 2px 0 4px -1px var(--color-panel-shadow);
  cursor: pointer;
}
.collapse-toggle:hover {
  background-color: var(--color-button-hover-bg);
}
.collapse-toggle-right {
  top: 50%;
  transform: translateY(-50%);
  left: 100%;
  margin-left: 0;
  border-top-right-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

#user-panel-wrapper:has(#user-panel) .collapse-toggle-right {
  left: auto;
  right: -24px;
}

#user-panel-wrapper:has(#user-panel) {
  left: 1rem;
}
</style>
