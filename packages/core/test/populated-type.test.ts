import {expect, test} from 'bun:test';
import {z} from 'zod/v4';
import {zRef, type PopulatedSchema} from '../src/index.js';

test('PopulatedSchema should correctly extract types', () => {
  const UserSchema = z.object({
    _id: z.string(),
    name: z.string(),
  });

  const PostSchema = z.object({
    _id: z.string(),
    title: z.string(),
    author: zRef('User', UserSchema),
    mentions: z.array(zRef('User', UserSchema)),
  });

  type Post = z.infer<typeof PostSchema>;
  type PopulatedPost = PopulatedSchema<typeof PostSchema, 'author' | 'mentions'>;

  const post: Post = {
    _id: '123',
    title: 'Hello World',
    author: '123',
    mentions: ['789'],
  };

  // Type check (this is more of a compile-time test, but we can verify properties)
  const populatedPost: PopulatedPost = {
    _id: '123',
    title: 'Hello World',
    author: {
      _id: '456',
      name: 'John Doe',
    },
    mentions: [
      {
        _id: '789',
        name: 'Jane Doe',
      },
    ],
  };

  expect(typeof post.author).toBe('string');
  expect(typeof populatedPost.author).not.toBe('string');
  expect(populatedPost.author.name).toBe('John Doe');
  expect(populatedPost.mentions[0].name).toBe('Jane Doe');
});

test('PopulatedSchema should handle optional and nullable fields', () => {
  const UserSchema = z.object({
    _id: z.string(),
    name: z.string(),
  });

  const PostSchema = z.object({
    optionalUser: zRef('User', UserSchema).optional(),
    nullableUser: zRef('User', UserSchema).nullable(),
  });

  type PopulatedPost = PopulatedSchema<typeof PostSchema>;

  const post: PopulatedPost = {
    optionalUser: {_id: '1', name: 'Opt'},
    nullableUser: null,
  };

  expect(post.optionalUser?.name).toBe('Opt');
  expect(post.nullableUser).toBeNull();

  const post2: PopulatedPost = {
    optionalUser: undefined,
    nullableUser: {_id: '2', name: 'Null'},
  };

  expect(post2.optionalUser).toBeUndefined();
  expect(post2.nullableUser?.name).toBe('Null');
});

test('PopulatedSchema should work with complex nested structures', () => {
  const UserSchema = z.object({
    _id: z.string(),
    name: z.string(),
  });

  const GroupSchema = z.object({
    _id: z.string(),
    members: z.array(
      z.object({
        user: zRef('User', UserSchema),
        role: z.string(),
      }),
    ),
  });

  // Now PopulatedSchema populates nested keys too!
  type PopulatedGroup = PopulatedSchema<typeof GroupSchema, 'members'>;

  const group: PopulatedGroup = {
    _id: 'g1',
    members: [
      {
        user: {_id: 'u1', name: 'John'},
        role: 'admin',
      },
    ],
  };

  expect(group.members[0].user.name).toBe('John');
});

test('PopulatedSchema type-safety with @ts-expect-error', () => {
  const UserSchema = z.object({
    _id: z.string(),
    name: z.string(),
  });

  const PostSchema = z.object({
    author: zRef('User', UserSchema),
  });

  type PopulatedPost = PopulatedSchema<typeof PostSchema>;

  // @ts-expect-error - author should be object
  const _invalid1: PopulatedPost = {author: '123'};
  // eslint-disable-next-line
  void _invalid1;

  const _invalid2: PopulatedPost = {
    // @ts-expect-error - author should be UserSchema, missing 'name'
    author: {_id: '123'},
  };
  // eslint-disable-next-line
  void _invalid2;

  const valid: PopulatedPost = {
    author: {_id: '123', name: 'John'},
  };

  expect(valid.author.name).toBe('John');
});
