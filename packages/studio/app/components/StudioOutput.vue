<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps<{ modelValue: string }>();
const outputContainer = ref<HTMLElement | null>(null);
const editorInstance = shallowRef<any>(null);
const colorMode = useColorMode();

onMounted(async () => {
  if (!outputContainer.value) return;

  const monaco = await import("monaco-editor");

  editorInstance.value = monaco.editor.create(outputContainer.value, {
    value: props.modelValue,
    language: "typescript",
    theme: colorMode.value === "dark" ? "vs-dark" : "vs",
    minimap: { enabled: false },
    automaticLayout: true,
    readOnly: true,
    fontSize: 14,
    padding: { top: 16 },
    scrollBeyondLastLine: false,
    wordWrap: "on",
  });
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (editorInstance.value) {
      editorInstance.value.setValue(newValue);
    }
  },
);

onBeforeUnmount(() => {
  if (editorInstance.value) {
    editorInstance.value.dispose();
  }
});
watch(() => colorMode.value, (mode) => {
  editorInstance.value?.updateOptions({ theme: mode === "dark" ? "vs-dark" : "vs" });
});
</script>

<template>
  <div ref="outputContainer" class="w-full h-full" />
</template>
