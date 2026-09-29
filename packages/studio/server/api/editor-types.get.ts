import { setHeader } from "h3";
import editorTypes from "../utils/editor-types.json";

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "public, max-age=3600");
  return editorTypes;
});
