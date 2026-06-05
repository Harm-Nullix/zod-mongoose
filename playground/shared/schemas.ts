import { z } from "zod/v4";
import {
  zObjectId,
  zRef,
  zBuffer,
  type PopulatedSchema,
} from "@nullix/zod-mongoose";
import { withMongoose } from "@nullix/zod-mongoose";

export const UserZodSchema = z
  .object({
    _id: zObjectId(),
    username: withMongoose(z.string().min(3).max(30), {
      unique: true,
      lowercase: true,
      index: true,
    }),
    email: withMongoose(z.email(), {
      unique: true,
      lowercase: true,
    }),
    fullName: z.string().optional(),
    // Intersection example
    profile: z.intersection(
      z.object({ bio: z.string().optional() }),
      z.object({ website: z.url().optional() }),
    ),
    // XOR example
    contact: z
      .xor([
        z.object({ type: z.literal("phone"), phoneNumber: z.string() }),
        z.object({ type: z.literal("slack"), slackId: z.string() }),
      ])
      .optional(),
  })
  .describe("User");

export type User = z.infer<typeof UserZodSchema>;

// Discriminated Union example
export const ActivityZodSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("login"), timestamp: z.coerce.date() }),
    z.object({
      type: z.literal("post_create"),
      postId: zObjectId(),
      timestamp: z.coerce.date(),
    }),
    z.object({
      type: z.literal("comment_create"),
      commentId: z.string(),
      timestamp: z.coerce.date(),
    }),
  ])
  .describe("Activity");

export type Activity = z.infer<typeof ActivityZodSchema>;

// Settings with Tuple, Record, and Map
export const SettingsZodSchema = z
  .object({
    _id: zObjectId(),
    // Tuple example
    location: z.tuple([z.number(), z.number()]).optional(), // [lat, lng]
    // Record example (converted to Map in Mongoose)
    preferences: z.record(z.string(), z.string()).default({}),
    // Explicit Map example
    metadata: z.map(z.string(), z.any()).optional(),
  })
  .describe("Settings");

export type Settings = z.infer<typeof SettingsZodSchema>;

// Asset with Buffer and Literal
export const AssetZodSchema = z
  .object({
    _id: zObjectId(),
    name: z.string(),
    type: z.union([z.literal("image"), z.literal("pdf"), z.literal("text")]),
    data: zBuffer(),
    tags: z.array(z.string()).default([]),
  })
  .describe("Asset");

export type Asset = z.infer<typeof AssetZodSchema>;

// Task with Composite ID
export const TaskZodSchema = z
  .object({
    _id: withMongoose(
      z.object({
        orgId: z.string(),
        taskId: z.number(),
      }),
      { includeId: true },
    ),
    title: z.string(),
    description: z.string().optional(),
    assignedTo: zRef("User", UserZodSchema).optional(),
  })
  .describe("Task");

export type Task = z.infer<typeof TaskZodSchema>;

export const PostZodSchema = z
  .object({
    _id: zObjectId(),
    title: z.string().min(5).max(100),
    content: z.string().min(10),
    author: zRef("User", UserZodSchema),
    mentions: z.array(zRef("User", UserZodSchema)).default([]),
    published: z.boolean().default(false),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  })
  .describe("Post");

export type Post = z.infer<typeof PostZodSchema>;

/**
 * Input schema for creating a new Post.
 * We omit timestamp fields that are handled by the server.
 * _id is already optional in PostZodSchema because of zObjectId() update.
 * We also ensure that author and mentions can be strings (ObjectIds) since that's what's typically sent from a form.
 */
export const PostInputSchema = PostZodSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  author: zObjectId().optional(),
  mentions: z.array(zObjectId()).default([]),
});

export type PostInput = z.infer<typeof PostInputSchema>;

// Use the Populated helper to define PopulatedPost
export type PopulatedPost = PopulatedSchema<Post, "author" | "mentions">;
