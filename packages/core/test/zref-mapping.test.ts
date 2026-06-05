import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {zRef, toMongooseSchema} from '../src/index.js';

describe('zRef Mongoose Mapping', () => {
  test('should map to ObjectId in Mongoose', () => {
    const UserSchema = z.object({name: z.string()});
    const PostSchema = z.object({
      author: zRef('User', UserSchema),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('author') as any;

    expect(authorPath.instance).toBe('ObjectId');
    expect(authorPath.options.ref).toBe('User');
  });

  test('should handle arrays of zRef', () => {
    const UserSchema = z.object({name: z.string()});
    const PostSchema = z.object({
      mentions: z.array(zRef('User', UserSchema)),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const mentionsPath = mongooseSchema.path('mentions') as any;

    expect(mentionsPath.instance).toBe('Array');
    expect(mentionsPath.embeddedSchemaType.instance).toBe('ObjectId');
    expect(mentionsPath.embeddedSchemaType.options.ref).toBe('User');
  });
});
