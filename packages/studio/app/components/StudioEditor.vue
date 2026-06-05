<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits(["update:modelValue"]);

const editorContainer = ref<HTMLElement | null>(null);
// shallowRef is REQUIRED for Monaco instances in Vue 3!
const editorInstance = shallowRef<any>(null);

onMounted(async () => {
  if (!editorContainer.value) return;

  // Dynamically import monaco
  const monaco = await import("monaco-editor");

  monaco.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.typescript.ModuleKind.ESNext, // Allow ES6 exports
    noEmit: true,
  });

  // 1. Zod v4 shim (so imports don't error in the editor)
  monaco.typescript.typescriptDefaults.addExtraLib(
    `
    declare module 'zod/v4' {
      export const z: any;
      export type ZodTypeAny = any;
      export type ZodObject<T> = any;
      export type ZodString = any;
      export type ZodNumber = any;
    }
  `,
    "file:///node_modules/@types/zod-v4/index.d.ts",
  );

  monaco.typescript.typescriptDefaults.addExtraLib(
    `
    declare module '@nullix/zod-mongoose' {
      import { z } from 'zod/v4';
      import mongoose, { SchemaOptions } from 'mongoose';
      import * as hookable from 'hookable';

      interface MongooseMeta extends Record<string, any> {
          explicitId?: boolean;
      }
      declare const mongooseRegistry: z.core.$ZodRegistry<MongooseMeta, z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
      declare function withMongoose<T extends z.ZodTypeAny>(schema: T, meta: MongooseMeta): T;

      type ToMongooseType<T extends z.ZodTypeAny> = any; // Simplified for Monaco perf

      export declare function extractMongooseDef<T extends z.ZodTypeAny>(schema: T, visited?: Map<z.ZodTypeAny, any>, isField?: boolean): ToMongooseType<T> & Record<string, any>;

      interface ToMongooseSchemaOptions extends SchemaOptions {
          plugins?: Array<(schema: mongoose.Schema, options?: any) => void>;
      }

      export declare function toMongooseSchema<T extends z.ZodTypeAny>(schema: T, options?: ToMongooseSchemaOptions): mongoose.Schema<z.infer<T>>;

      export declare const zObjectId: (options?: MongooseMeta) => any;
      export declare const zBuffer: (options?: MongooseMeta) => any;
      export declare const zRef: <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => any;
      export declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: any, updatedAtField?: any) => any;

      export type PopulatedSchema<T, K extends keyof T> = any;
      export declare const bufferMongooseGetter: (value: unknown) => any;
      export declare const getMongoose: () => any;
      export declare const setFrontendMode: (enabled: boolean) => void;
      export declare const getFrontendMode: () => boolean;

      export type MongooseZodHooks = any;
      export declare const hooks: any;
      export declare function callHookSync<Name extends keyof MongooseZodHooks>(name: Name, ...args: Parameters<MongooseZodHooks[Name]>): void;
    }
  `,
    "file:///node_modules/@nullix/zod-mongoose/index.d.ts",
  );

  editorInstance.value = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: "typescript",
    theme: "vs-dark",
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 14,
    padding: { top: 16 },
  });

  editorInstance.value.onDidChangeModelContent(() => {
    emit("update:modelValue", editorInstance.value?.getValue() || "");
  });
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (editorInstance.value && editorInstance.value.getValue() !== newValue) {
      editorInstance.value.setValue(newValue);
    }
  },
);

onBeforeUnmount(() => {
  if (editorInstance.value) {
    editorInstance.value.dispose();
  }
});
</script>

<template>
  <div ref="editorContainer" class="w-full h-full" />
</template>
