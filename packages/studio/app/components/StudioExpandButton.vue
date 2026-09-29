<script setup lang="ts">
defineProps<{ expanded: boolean; label: string }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button type="button" class="studio-expand-button" :aria-label="expanded ? `Restore ${label}` : `Expand ${label}`" :title="expanded ? 'Restore panel' : 'Expand panel'" @click="emit('toggle')">
    <svg v-if="expanded" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 2v5H2m16 6h-5v5M2 7l5-5m6 16 5-5" /></svg>
    <svg v-else viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 7V2h5m6 16h5v-5M2 2l5 5m6 6 5 5" /></svg>
  </button>
</template>
