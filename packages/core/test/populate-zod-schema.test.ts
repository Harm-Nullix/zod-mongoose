import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {zRef, populateZodSchema, type PopulatedSchema} from '../src/index.js';

describe('populateZodSchema helper', () => {
  const UserSchema = z.object({
    _id: z.string(),
    name: z.string(),
  });

  const PostSchema = z.object({
    title: z.string(),
    author: zRef('User', UserSchema),
    mentions: z.array(zRef('User', UserSchema)),
  });

  // type Post = z.output<typeof PostSchema>;
  // const post : Post = {} as Post
  // post.author

  test('should return a schema where specified keys are populated', () => {
    const PopulatedPostSchema = populateZodSchema(PostSchema, ['author', 'mentions']);

    const id = '507f1f77bcf86cd799439011';
    const populatedData = {
      title: 'Hello World',
      author: {_id: id, name: 'John'},
      mentions: [{_id: id, name: 'Jane'}],
    };

    const parsed = PopulatedPostSchema.parse(populatedData);
    expect(parsed.author.name).toBe('John');
    expect(parsed.mentions[0].name).toBe('Jane');
  });

  test('should not populate keys not specified', () => {
    const SemiPopulatedSchema = populateZodSchema(PostSchema, ['author']);

    const id = '507f1f77bcf86cd799439011';
    const data = {
      title: 'Hello World',
      author: {_id: id, name: 'John'},
      mentions: [id],
    };

    const parsed = SemiPopulatedSchema.parse(data);
    expect(parsed.author.name).toBe('John');
    expect(parsed.mentions[0]).toBe(id);
  });

  test('should populate all possible fields if no keys provided', () => {
    const FullPopulatedPostSchema = populateZodSchema(PostSchema);

    const id = '507f1f77bcf86cd799439011';
    const populatedData = {
      title: 'Hello World',
      author: {_id: id, name: 'John'},
      mentions: [{_id: id, name: 'Jane'}],
    };

    const parsed = FullPopulatedPostSchema.parse(populatedData);
    expect(parsed.author.name).toBe('John');
    expect(parsed.mentions[0].name).toBe('Jane');
  });

  test('PopulatedSchema type should work without keys', () => {
    type FullPost = PopulatedSchema<typeof PostSchema>;

    const post: FullPost = {
      title: 'Hello World',
      author: {_id: '123', name: 'John'},
      mentions: [{_id: '456', name: 'Jane'}],
    };

    expect(post.author.name).toBe('John');
    expect(post.mentions[0].name).toBe('Jane');
  });

  test('PopulatedSchema type should work with inferred types', () => {
    type PostInferred = z.infer<typeof PostSchema>;
    type FullPost = PopulatedSchema<PostInferred>;

    const post: FullPost = {
      title: 'Hello World',
      author: {_id: '123', name: 'John'},
      mentions: [{_id: '456', name: 'Jane'}],
    };

    expect(post.author.name).toBe('John');
    expect(post.mentions[0].name).toBe('Jane');
  });

  test('should handle optional and nullable fields in populateZodSchema', () => {
    const ComplexPostSchema = z.object({
      optionalAuthor: zRef('User', UserSchema).optional(),
      nullableAuthor: zRef('User', UserSchema).nullable(),
    });

    const PopulatedSchema = populateZodSchema(ComplexPostSchema);
    const id = '507f1f77bcf86cd799439011';

    // Test optional
    expect(
      PopulatedSchema.parse({optionalAuthor: undefined, nullableAuthor: null}).optionalAuthor,
    ).toBeUndefined();
    expect(
      PopulatedSchema.parse({optionalAuthor: {_id: id, name: 'John'}, nullableAuthor: null})
        .optionalAuthor.name,
    ).toBe('John');

    // Test nullable
    expect(PopulatedSchema.parse({nullableAuthor: null}).nullableAuthor).toBeNull();
    expect(
      PopulatedSchema.parse({nullableAuthor: {_id: id, name: 'John'}}).nullableAuthor.name,
    ).toBe('John');
  });

  test('populated schema should reject raw IDs (runtime)', () => {
    const PopulatedPostSchema = populateZodSchema(PostSchema, ['author']);
    const id = '507f1f77bcf86cd799439011';

    // Should throw because 'author' expects an object now
    expect(() =>
      PopulatedPostSchema.parse({
        title: 'Fail',
        author: id,
        mentions: [id],
      }),).toThrow();
  });

  test('populated schema type safety with @ts-expect-error', () => {
    const PopulatedPostSchema = populateZodSchema(PostSchema, ['author']);
    type PopulatedPost = z.infer<typeof PopulatedPostSchema>;

    const id = '507f1f77bcf86cd799439011';

    const _invalid: PopulatedPost = {
      title: 'Fail',
      // @ts-expect-error - author should be object
      author: id,
      mentions: [id],
    };
    // eslint-disable-next-line
    void _invalid;

    const valid: PopulatedPost = {
      title: 'Success',
      author: {_id: id, name: 'John'},
      mentions: [id],
    };

    expect(valid.author.name).toBe('John');
  });

  test('should handle recursive population for nested objects and arrays', () => {
    const GroupSchema = z.object({
      _id: z.string(),
      members: z.array(
        z.object({
          user: zRef('User', UserSchema),
          role: z.string(),
        }),
      ),
      metadata: z.object({
        creator: zRef('User', UserSchema),
      }),
    });

    const PopulatedGroupSchema = populateZodSchema(GroupSchema);
    const id = '507f1f77bcf86cd799439011';

    const data = {
      _id: 'g1',
      members: [
        {
          user: {_id: id, name: 'John'},
          role: 'admin',
        },
      ],
      metadata: {
        creator: {_id: id, name: 'Jane'},
      },
    };

    const parsed = PopulatedGroupSchema.parse(data);
    expect(parsed.members[0].user.name).toBe('John');
    expect(parsed.metadata.creator.name).toBe('Jane');
  });
});
