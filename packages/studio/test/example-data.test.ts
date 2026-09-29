import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { z } from "zod/v4";
import { setMongoose, zObjectId, zPoint } from "@nullix/zod-mongoose";
import { createExample } from "../server/utils/example-data.ts";

setMongoose(mongoose);

test("generates JSON input that satisfies common Zod checks", () => {
  const schema = z.object({
    email: z.email(),
    age: z.number().int().min(18).max(30),
    role: z.enum(["reader", "admin"]).default("reader"),
    tags: z.array(z.string().min(3)).min(2),
    nickname: z.string().optional(),
  });
  const input = createExample(schema);
  const result = schema.safeParse(JSON.parse(JSON.stringify(input)));
  assert.equal(result.success, true);
  assert.equal("nickname" in (input as object), false);
  if (result.success) assert.equal(result.data.role, "reader");
});

test("generates valid examples for zod-mongoose ObjectIds and GeoJSON points", () => {
  const schema = z.object({ id: zObjectId(), location: zPoint() });
  const input = createExample(schema);
  assert.equal(schema.safeParse(JSON.parse(JSON.stringify(input))).success, true);
});

test("generates JSON input for a root schema with a default", () => {
  const schema = z.string().min(3).default("fallback");
  const input = createExample(schema);
  assert.equal(schema.safeParse(JSON.parse(JSON.stringify(input))).success, true);
});
