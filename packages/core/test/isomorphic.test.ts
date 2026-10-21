import {test, expect, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';

// 1. Import both implementations explicitly
import * as Backend from '../src/index.js';
import * as Frontend from '../src/index.frontend.js'; // Direct reference to the frontend source entry

describe('Isomorphic Support', () => {
  test('should handle ObjectId as string in frontend mode', () => {
    // Use the true frontend implementation
    const schema = z.object({
      _id: Frontend.zObjectId(),
    });

    const validData = {_id: '507f1f77bcf86cd799439011'};
    const invalidData = {_id: 'not-an-object-id'};

    expect(schema.parse(validData)).toEqual(validData);
    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  test('should handle Buffer as Uint8Array in frontend mode', () => {
    // Use the true frontend implementation
    const schema = z.object({
      data: Frontend.zBuffer(),
    });

    const validData = {data: new Uint8Array()};
    expect(schema.parse(validData)).toEqual(validData);
  });

  test('should convert backend schemas to proper Mongoose types', () => {
    // The converter logic (toMongooseSchema) lives on the backend implementation
    // and expects schemas that were built using backend primitives.
    const schema = z.object({
      _id: Backend.zObjectId(),
      buf: Backend.zBuffer(),
    });

    const mongooseSchema = Backend.toMongooseSchema(schema);

    expect(mongooseSchema.path('_id').instance).toBe('ObjectId');
    expect(mongooseSchema.path('buf').instance).toBe('Buffer');
  });

  test('shared-schema.ts should work in both modes', async () => {
    // If you have a shared schema file that you want to test across environments,
    // the cleanest approach is to evaluate how it handles input maps on both sides.

    // Test Backend Mode expectations
    const oid = new mongoose.Types.ObjectId();
    const backendSchema = z.object({
      _id: Backend.zObjectId(),
    });

    expect(backendSchema.parse({_id: oid})._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(backendSchema.parse({_id: oid.toString()})._id).toBeInstanceOf(mongoose.Types.ObjectId);

    // Test Frontend Mode expectations
    const frontendSchema = z.object({
      _id: Frontend.zObjectId(),
    });

    const oidStr = '507f1f77bcf86cd799439011';
    const parsed = frontendSchema.parse({_id: oidStr});

    expect(typeof parsed._id).toBe('string');
    expect(parsed._id).toBe(oidStr);
  });

  test('should support frontend zRef codec and metadata extraction', () => {
    const UserSchema = z.object({
      _id: Frontend.zObjectId(),
      name: z.string(),
    });

    const PostSchema = z.object({
      title: z.string(),
      author: Frontend.zRef('User', UserSchema),
    });

    const authorOid = '507f1f77bcf86cd799439011';

    // Parse with raw ID string
    const parsedWithId = PostSchema.parse({
      title: 'Hello',
      author: authorOid,
    });
    expect(parsedWithId.author).toBe(authorOid);

    // Parse with populated object containing _id (decoded to _id)
    const parsedWithPopulated = PostSchema.parse({
      title: 'Hello',
      author: {_id: authorOid, name: 'Alice'},
    });
    expect(parsedWithPopulated.author).toBe(authorOid);

    // Verify metadata attached via withMongoose
    const meta = Frontend.getMongooseMeta(PostSchema.shape.author);
    expect(meta?.ref).toBe('User');
    expect(meta?.type).toBe('ObjectId');
  });

  test('should support frontend populateZodSchema and timestamps', () => {
    const AuthorSchema = z.object({
      _id: Frontend.zObjectId(),
      name: z.string(),
    });

    const BookSchema = z.object({
      title: z.string(),
      author: Frontend.zRef('Author', AuthorSchema),
    });

    const populatedSchema = Frontend.populateZodSchema(BookSchema, ['author']);
    const validData = {
      title: 'Zod in Action',
      author: {
        _id: '507f1f77bcf86cd799439011',
        name: 'Bob',
      },
    };

    expect(populatedSchema.parse(validData)).toEqual(validData);

    const timestamps = Frontend.genTimestampsSchema('created_at', 'updated_at');
    expect(timestamps).toHaveProperty('created_at');
    expect(timestamps).toHaveProperty('updated_at');
  });
});
