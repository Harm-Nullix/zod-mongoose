import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {zPopulated} from '../src/mongoose-helpers.js';
import {toMongooseSchema} from '../src/converter.js';
import {describe, it, expect} from 'bun:test';

describe('zPopulated helper', () => {
  it('should allow either ObjectId or a populated object', () => {
    const UserSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      title: z.string(),
      author: zPopulated('User', UserSchema),
    });

    // Valid as unpopulated
    const unpopulated = {
      title: 'Hello World',
      author: new mongoose.Types.ObjectId(),
    };
    expect(PostSchema.parse(unpopulated)).toEqual(unpopulated);

    // Valid as populated
    const populated = {
      title: 'Hello World',
      author: { name: 'John Doe' },
    };
    expect(PostSchema.parse(populated)).toEqual(populated);

    // Valid as string ObjectId (unpopulated)
    const stringId = new mongoose.Types.ObjectId().toHexString();
    const withStringId = {
        title: 'Hello World',
        author: stringId,
    };
    const parsed = PostSchema.parse(withStringId);
    expect(parsed.title).toBe(withStringId.title);
    expect(parsed.author.toString()).toBe(withStringId.author);

    // Invalid
    expect(() => PostSchema.parse({ title: 'Hi', author: 123 })).toThrow();
  });

  it('should convert to a Mongoose schema with ref', () => {
    const UserSchema = z.object({
      name: z.string(),
    });

    const PostSchema = z.object({
      title: z.string(),
      author: zPopulated('User', UserSchema),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('author') as any;

    expect(authorPath.instance).toBe('ObjectId');
    expect(authorPath.options.ref).toBe('User');
  });

  it('should handle arrays of populated objects', () => {
    const TagSchema = z.object({
        name: z.string(),
    });

    const PostSchema = z.object({
        tags: z.array(zPopulated('Tag', TagSchema)),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const tagsPath = mongooseSchema.path('tags') as any;

    expect(tagsPath.instance).toBe('Array');
    expect(tagsPath.embeddedSchemaType.instance).toBe('ObjectId');
    expect(tagsPath.embeddedSchemaType.options.ref).toBe('Tag');
  });
});
