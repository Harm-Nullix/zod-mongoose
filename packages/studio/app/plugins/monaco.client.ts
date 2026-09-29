import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

export default defineNuxtPlugin(() => {
  // Tell Monaco how to load its Web Workers via Vite
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }
      if (label === "json") return new jsonWorker();
      return new editorWorker();
    },
  };
});
