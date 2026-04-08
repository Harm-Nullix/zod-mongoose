<script setup lang="ts">
import { ref, watch } from "vue";
// Use lodash/debounce or vueuse in a real app, but setTimeout works for now
let debounceTimer: any;

const config = useRuntimeConfig();
const isLocalMode = ref(config.public.isLocalMode);
const isDocsMode = ref(config.public.isDocsMode);

const sourceCode = ref(`import { z } from 'zod/v4';
import { extractMongooseDef, toMongooseSchema } from '@nullix/zod-mongoose';

const UserSchema = z.object({
  name: z.string(),
  age: z.number().optional()
});

// Export your schema so the Studio can transform it
export default UserSchema;`);

const outputDef = ref("// Definition output...");
const outputSchema = ref("// Mongoose Schema output...");

const isCompiling = ref(false);

const handleCompile = async () => {
  isCompiling.value = true;
  try {
    const response = await $fetch("/api/parse", {
      method: "POST",
      body: { sourceCode: sourceCode.value },
    });
    outputDef.value = `// Result of extractMongooseDef()\nconst definition = ${response.definition};`;
    outputSchema.value = `// Result of toMongooseSchema().obj\nconst schemaObj = ${response.schemaObj};`;
  } catch (error: any) {
    const errText = `// Error\n${error.data?.message || error.message}`;
    outputDef.value = errText;
    outputSchema.value = errText;
  } finally {
    isCompiling.value = false;
  }
};

// Auto-compile with a slight delay as they type
watch(
  sourceCode,
  () => {
    if (isDocsMode.value) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleCompile, 600);
  }
);

// Initial compile for Docs Mode
if (isDocsMode.value) {
  handleCompile();
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <header
      class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-3 px-4 flex justify-between items-center shrink-0"
    >
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold text-primary">
          @nullix/zod-mongoose Studio
        </h1>
        <UBadge v-if="isLocalMode" color="success" variant="soft"
          >Local Mode</UBadge
        >
        <UBadge v-else color="info" variant="soft">Docs Mode</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="isDocsMode"
          icon="i-heroicons-play-solid"
          color="primary"
          :loading="isCompiling"
          @click="handleCompile"
        >
          Run
        </UButton>
        <span v-else-if="isCompiling" class="text-sm text-gray-500"
          >Transforming...</span
        >
      </div>
    </header>

    <div
      class="flex-1 grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-800 min-h-0"
    >
      <!-- Left: Editor -->
      <div class="bg-white dark:bg-gray-950 h-full relative">
        <ClientOnly>
          <StudioEditor v-model="sourceCode" />
        </ClientOnly>
      </div>

      <!-- Right: Split Outputs -->
      <div class="flex flex-col h-full gap-px bg-gray-200 dark:bg-gray-800">
        <!-- Top Right: Definition -->
        <div
          class="flex-1 bg-white dark:bg-gray-950 relative flex flex-col min-h-0"
        >
          <div
            class="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 z-10"
          >
            extractMongooseDef()
          </div>
          <div class="flex-1 relative">
            <ClientOnly>
              <StudioOutput :model-value="outputDef" />
            </ClientOnly>
          </div>
        </div>

        <!-- Bottom Right: Schema -->
        <div
          class="flex-1 bg-white dark:bg-gray-950 relative flex flex-col min-h-0"
        >
          <div
            class="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 z-10"
          >
            toMongooseSchema()
          </div>
          <div class="flex-1 relative">
            <ClientOnly>
              <StudioOutput :model-value="outputSchema" />
            </ClientOnly>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
