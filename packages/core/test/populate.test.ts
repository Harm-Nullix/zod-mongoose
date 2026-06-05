import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {zRef} from '../src/mongoose-helpers.js';
import {toMongooseSchema} from '../src/converter.js';
import {describe, it, expect} from 'bun:test';

describe('zRef helper', () => {
  it('should allow either ObjectId or a populated object', () => {
    const UserSchema = z.object({
      _id: z.any(),
      name: z.string(),
    });

    const PostSchema = z.object({
      title: z.string(),
      author: zRef('User', UserSchema),
    });

    const id = new mongoose.Types.ObjectId();

    // Valid as unpopulated
    const unpopulated = {
      title: 'Hello World',
      author: id,
    };
    // We use toString() comparison because our brand might make it not strictly equal to the original id object if it's transformed
    const parsedUnpopulated = PostSchema.parse(unpopulated);
    expect(parsedUnpopulated.author.toString()).toEqual(id.toString());

    // Valid as populated (should be transformed to ID)
    const populated = {
      title: 'Hello World',
      author: {_id: id, name: 'John Doe'},
    };
    const parsedPopulated = PostSchema.parse(populated);
    expect(parsedPopulated.author.toString()).toEqual(id.toString());

    // Valid as string ObjectId (unpopulated)
    const stringId = id.toHexString();
    const withStringId = {
      title: 'Hello World',
      author: stringId,
    };
    const parsed = PostSchema.parse(withStringId);
    expect(parsed.title).toBe(withStringId.title);
    expect(parsed.author.toString()).toBe(withStringId.author);

    // Invalid
    expect(() => PostSchema.parse({title: 'Hi', author: 123})).toThrow();
    // Invalid populated (no _id)
    expect(() => PostSchema.parse({title: 'Hi', author: {name: 'No ID'}})).toThrow();
  });

  it('should convert to a Mongoose schema with ref', () => {
    const UserSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      title: z.string(),
      author: zRef('User', UserSchema),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('author');

    expect(authorPath.instance).toBe('ObjectId');
    expect(authorPath.options.ref).toBe('User');
  });

  it('should handle arrays of populated objects', () => {
    const TagSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      tags: z.array(zRef('Tag', TagSchema)),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const tagsPath = mongooseSchema.path('tags') as any;

    expect(tagsPath.instance).toBe('Array');
    expect(tagsPath.embeddedSchemaType.instance).toBe('ObjectId');
    expect(tagsPath.embeddedSchemaType.options.ref).toBe('Tag');
  });

  it('should handle zRef with additional Mongoose options', () => {
    const UserSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      author: zRef('User', UserSchema, {required: true, index: true}),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('author') as any;

    expect(authorPath.options.required).toBe(true);
    expect(authorPath._index).not.toBeNull();
  });

  it('should handle zRef inside nested objects during conversion', () => {
    const UserSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      metadata: z.object({
        author: zRef('User', UserSchema),
      }),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('metadata.author') as any;

    expect(authorPath.instance).toBe('ObjectId');
    expect(authorPath.options.ref).toBe('User');
  });

  it('should handle nullable zRef in Mongoose schema', () => {
    const UserSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      author: zRef('User', UserSchema).nullable(),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('author') as any;

    // In Mongoose, nullable usually just means not required, unless we set some specific validator
    // But we check that it's still an ObjectId
    expect(authorPath.instance).toBe('ObjectId');
    expect(authorPath.options.ref).toBe('User');
  });
});
