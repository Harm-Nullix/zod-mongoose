<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<{
  language?: "typescript" | "json";
  label?: string;
}>(), { language: "typescript", label: "Code editor" });

const container = ref<HTMLElement | null>(null);
const editor = shallowRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
const editorUnavailable = shallowRef(false);
const colorMode = useColorMode();
let typeLibrariesLoaded: Promise<void> | undefined;

const helperNames = [
  "bufferMongooseGetter", "callHookSync", "extractMongooseDef", "genTimestampsSchema",
  "getFrontendMode", "getMongoose", "getMongooseMeta", "hooks", "mongooseRegistry",
  "objectStrictness", "populateZodSchema", "setFrontendMode", "setMongoose",
  "toMongooseSchema", "toStrictModel", "unwrapZodSchema", "withMongoose",
  "zBuffer", "zObjectId", "zPoint", "zPolygon", "zRef",
];

onMounted(async () => {
  if (!container.value) return;
  try {
    const monaco = await import("monaco-editor");
    if (!container.value) return;
    if (props.language === "typescript") {
      const tsMonaco: any = await import("monaco-editor/esm/vs/language/typescript/monaco.contribution.js");
      tsMonaco.typescriptDefaults.setCompilerOptions({
        target: tsMonaco.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: tsMonaco.ModuleResolutionKind.NodeJs,
        module: tsMonaco.ModuleKind.ESNext,
        noEmit: true,
      });
      typeLibrariesLoaded ||= $fetch<Record<string, string>>("/api/editor-types").then((files) => {
        for (const [path, content] of Object.entries(files)) tsMonaco.typescriptDefaults.addExtraLib(content, path);
      }).catch(() => {
        // Types improve completion, but a missing endpoint must not hide the editor.
      });
      await typeLibrariesLoaded;
      tsMonaco.typescriptDefaults.addExtraLib(`
        declare const z: typeof import("zod/v4").z;
        declare const mongoose: any;
        ${helperNames.map((name) => `declare const ${name}: any;`).join("\n")}
        declare module '@nullix/zod-mongoose' {
          ${helperNames.map((name) => `export const ${name}: any;`).join("\n")}
        }
      `, "file:///node_modules/@types/studio/globals.d.ts");
    }

    editor.value = monaco.editor.create(container.value, {
      value: model.value,
      language: props.language,
      theme: colorMode.value === "dark" ? "vs-dark" : "vs",
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 13,
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
      lineHeight: 23,
      padding: { top: 16, bottom: 16 },
      scrollBeyondLastLine: false,
      roundedSelection: false,
      wordWrap: "on",
      renderLineHighlight: "line",
      scrollbar: { verticalScrollbarSize: 7, horizontalScrollbarSize: 7 },
      ariaLabel: props.label,
    });
    editor.value.onDidChangeModelContent(() => { model.value = editor.value?.getValue() || ""; });
  } catch {
    editorUnavailable.value = true;
  }
});

watch(model, (value) => {
  if (editor.value && editor.value.getValue() !== value) editor.value.setValue(value);
});
watch(() => colorMode.value, (mode) => {
  editor.value?.updateOptions({ theme: mode === "dark" ? "vs-dark" : "vs" });
});

onBeforeUnmount(() => { editor.value?.dispose(); });
</script>

<template>
  <textarea v-if="editorUnavailable" v-model="model" class="studio-editor-fallback" :aria-label="label" spellcheck="false" />
  <div v-else ref="container" class="studio-monaco h-full w-full" />
</template>
