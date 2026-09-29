import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue";

export type ValidationResult = {
  status: "valid" | "invalid" | "json-error" | "parse-error" | "empty";
  parsed?: string;
  message?: string;
  issues?: { path: string; message: string; code: string }[];
};

export type ConversionResult = {
  definition?: string;
  schemaObj?: string;
  schemaTree?: string;
  schemaPaths?: string;
  error?: string;
};

type RunResponse = {
  schemaNames: string[];
  selectedSchema: string;
  validation: ValidationResult;
  conversion: ConversionResult;
  example?: string;
  exampleError?: string;
};

const STORAGE_KEY = "zod-mongoose-studio:v1";

export function useStudioRunner() {
  const config = useRuntimeConfig();
  const sourceCode = shallowRef(`// z and every @nullix/zod-mongoose helper are ready to use.
const UserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  age: z.number().int().min(18).optional(),
  role: z.enum(['reader', 'admin']).default('reader'),
});

const PostSchema = z.object({
  title: z.string().min(1),
  published: z.boolean().default(false),
});`);
  const inputData = shallowRef(`{
  "name": "  Ada Lovelace  ",
  "email": "ada@example.com",
  "age": 28
}`);
  const schemaNames = shallowRef<string[]>([]);
  const selectedSchema = shallowRef("");
  const validation = shallowRef<ValidationResult>({ status: "empty", message: "Run the studio to see parsed data." });
  const conversion = shallowRef<ConversionResult>({});
  const isRunning = shallowRef(false);
  const isDirty = shallowRef(false);
  const hasRun = shallowRef(false);
  const error = shallowRef("");
  const exampleError = shallowRef("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let runId = 0;

  async function run(action: "run" | "example" = "run") {
    if (!config.public.isExecutionEnabled) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    const currentRun = ++runId;
    const submittedSource = sourceCode.value;
    const submittedInput = inputData.value;
    isRunning.value = true;
    error.value = "";
    exampleError.value = "";
    try {
      const response = await $fetch<RunResponse>(config.public.isDocsMode ? "/api/studio/run" : "/api/parse", {
        method: "POST",
        body: {
          sourceCode: submittedSource,
          inputData: submittedInput,
          selectedSchema: selectedSchema.value || undefined,
          action,
        },
      });
      if (currentRun !== runId) return;
      schemaNames.value = response.schemaNames;
      hasRun.value = true;
      selectedSchema.value = response.selectedSchema;
      validation.value = response.validation;
      conversion.value = response.conversion;
      exampleError.value = response.exampleError || "";
      if (response.example && sourceCode.value === submittedSource && inputData.value === submittedInput) inputData.value = response.example;
      isDirty.value = sourceCode.value !== submittedSource || (inputData.value !== submittedInput && inputData.value !== response.example);
    } catch (caught: any) {
      if (currentRun !== runId) return;
      error.value = caught.data?.message || caught.message || "The studio could not run this schema.";
      validation.value = { status: "empty", message: "Run the studio to see parsed data." };
      conversion.value = {};
    } finally {
      if (currentRun === runId) isRunning.value = false;
    }
  }

  function selectSchema(name: string) {
    selectedSchema.value = name;
    isDirty.value = true;
    if (config.public.isExecutionEnabled) void run();
  }

  function saveSession() {
    if (!import.meta.client) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        sourceCode: sourceCode.value,
        inputData: inputData.value,
        selectedSchema: selectedSchema.value,
      }));
    } catch { /* Storage can be unavailable or full; the editor remains usable. */ }
  }

  watch(sourceCode, () => {
    isDirty.value = true;
    if (!config.public.isDocsMode) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void run(), 650);
    }
  });
  watch(inputData, () => { isDirty.value = true; }, { flush: "sync" });
  watch([sourceCode, inputData, selectedSchema], saveSession, { flush: "sync" });

  onMounted(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        if (typeof saved.sourceCode === "string" && saved.sourceCode.length <= 50_000) sourceCode.value = saved.sourceCode;
        if (typeof saved.inputData === "string" && saved.inputData.length <= 100_000) inputData.value = saved.inputData;
        if (typeof saved.selectedSchema === "string") selectedSchema.value = saved.selectedSchema;
      }
    } catch { /* Ignore invalid browser storage. */ }
    if (config.public.isExecutionEnabled) void run();
  });
  onBeforeUnmount(() => { if (debounceTimer) clearTimeout(debounceTimer); });

  return {
    sourceCode, inputData, schemaNames, selectedSchema, validation, conversion,
    isRunning, isDirty, hasRun, error, exampleError, run, selectSchema,
  };
}
