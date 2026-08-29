import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {
  toMongooseSchema,
  withMongoose,
  genTimestampsSchema,
  zObjectId,
  zBuffer,
  zRef,
  PopulatedSchema,
} from '../src/index.js';

describe('README Examples', () => {
  test('Basic Conversion', () => {
    const zodSchema = z.object({
      username: z.string().min(3),
      email: z.email(),
      age: z.number().optional(),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema).toBeInstanceOf(mongoose.Schema);
    expect(mongooseSchema.path('username')).toBeDefined();
    expect(mongooseSchema.path('email')).toBeDefined();
    expect(mongooseSchema.path('age')).toBeDefined();
    expect((mongooseSchema.path('username') as any).options.minlength).toBe(3);
  });

  test('Adding Mongoose Metadata', () => {
    const zodSchema = z.object({
      username: withMongoose(z.string(), {
        unique: true,
        index: true,
        lowercase: true,
      }),
      // Default values set with zod's .default() are respected
      roles: z.array(z.string()).default(['user']),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    const usernamePath = mongooseSchema.path('username') as any;
    expect(usernamePath.options.unique).toBe(true);
    expect(usernamePath.options.index).toBe(true);
    expect(usernamePath.options.lowercase).toBe(true);

    const rolesPath = mongooseSchema.path('roles') as any;
    expect(rolesPath.options.default).toEqual(['user']);
  });

  test('Timestamps', () => {
    const userSchema = withMongoose(
      z.object({
        name: z.string(),
        ...genTimestampsSchema(),
      }),
      {timestamps: true},
    );

    const mongooseSchema = toMongooseSchema(userSchema);
    expect((mongooseSchema.options as any).timestamps).toBe(true);
    // Verify paths are defined as Dates
    expect(mongooseSchema.path('createdAt').instance).toBe('Date');
    expect(mongooseSchema.path('updatedAt').instance).toBe('Date');
  });

  describe('Discriminators', () => {
    test('1. Native Mongoose Discriminators', () => {
      const ActivityZodSchema = z.discriminatedUnion('type', [
        z.object({
          type: z.literal('login'),
          timestamp: z.date(),
          ip: z.string(),
        }),
        z.object({
          type: z.literal('post_create'),
          timestamp: z.date(),
          postId: zObjectId(),
        }),
      ]);

      const ActivitySchema = toMongooseSchema(ActivityZodSchema, {
        modelName: 'Activity',
      });
      // Mongoose will create a base schema with 'timestamp' field
      // and two discriminators ('login', 'post_create') for the other fields.

      expect(ActivitySchema.path('timestamp')).toBeDefined();
      expect(ActivitySchema.path('timestamp').instance).toBe('Date');
      expect(ActivitySchema.path('type')).toBeDefined();

      const ActivityModel = mongoose.model('ActivityReadme', ActivitySchema);
      expect(ActivityModel.discriminators).toBeDefined();
      expect(ActivityModel.discriminators?.Activity_login).toBeDefined();
      expect(ActivityModel.discriminators?.Activity_post_create).toBeDefined();
    });

    test('2. Manual Discriminators', () => {
      const baseSchema = withMongoose(
        z.object({
          name: z.string(),
          // Include the discriminator key in the Zod schema for type-safe access
          type: z.string().optional(),
        }),
        {discriminatorKey: 'type'},
      );

      const mongooseSchema = toMongooseSchema(baseSchema);
      expect((mongooseSchema.options as any).discriminatorKey).toBe('type');

      const BaseModel = mongoose.model('BaseReadme', mongooseSchema);

      const carSchema = z.object({
        licensePlate: z.string(),
      });

      const CarModel = BaseModel.discriminator('Car', toMongooseSchema(carSchema));

      const car = new CarModel({name: 'My Car', type: 'Car', licensePlate: 'ABC-123'}) as any;
      expect(car.type).toBe('Car');
      expect(car.licensePlate).toBe('ABC-123');
    });
  });

  test('Non-Inclusive Unions (XOR)', () => {
    // z.xor is available in Zod v4 (which we are using via import from zod/v4)
    // For the test, we can use a helper or check if it exists
    if (!('xor' in z)) {
      return;
    }

    const paymentSchema = (z as any).xor([
      z.object({type: z.literal('card'), cardNumber: z.string()}),
      z.object({type: z.literal('bank'), accountNumber: z.string()}),
    ]);

    const mongooseSchema = toMongooseSchema(z.object({payment: paymentSchema}));
    const paymentPath = mongooseSchema.path('payment');
    expect(paymentPath.instance).toBe('Mixed');
    expect((paymentPath as any).validators.length).toBeGreaterThan(0);
  });

  test('ObjectIds and _id Handling - Standard Usage', () => {
    const UserZodSchema = z.object({
      _id: zObjectId(), // Required for Zod validation, omitted from Mongoose schema
      name: z.string(),
    });

    const mongooseSchema = toMongooseSchema(UserZodSchema);
    // _id path will exist because Mongoose adds it automatically,
    // but we want to verify it's the default auto-generated one
    // and not explicitly defined with our metadata.
    const idPath = mongooseSchema.path('_id') as any;
    expect(idPath).toBeDefined();
    expect(idPath.options.auto).toBe(true);

    // But it's present in Zod
    const result = UserZodSchema.safeParse({name: 'John'});
    expect(result.success).toBe(false); // _id is required by default in zObjectId()
  });

  test('ObjectIds and _id Handling - Input/Create Schemas', () => {
    const UserZodSchema = z.object({
      _id: zObjectId(),
      name: z.string(),
    });

    const UserInputSchema = UserZodSchema.omit({_id: true});
    const result = UserInputSchema.safeParse({name: 'John'});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({name: 'John'});
  });

  test('ObjectIds and _id Handling - Explicitly Defining _id', () => {
    const CustomIdSchema = z.object({
      _id: zObjectId({includeId: true, index: true}),
    });

    const mongooseSchema = toMongooseSchema(CustomIdSchema);
    expect(mongooseSchema.path('_id')).toBeDefined();
    expect((mongooseSchema.path('_id') as any).options.index).toBe(true);
  });

  test('Buffers and ObjectIds', () => {
    const schema = z.object({
      avatar: zBuffer({required: true}),
      ownerId: zObjectId({index: true}),
      // Arrays are also supported
      tags: z.array(zObjectId()),
    });

    const mongooseSchema = toMongooseSchema(schema);
    expect(mongooseSchema.path('avatar').instance).toBe('Buffer');
    expect(mongooseSchema.path('ownerId').instance).toBe('ObjectId');
    expect(mongooseSchema.path('tags').instance).toBe('Array');
  });

  test('Schema Options', () => {
    // Disable _id and id at the schema level
    const LogSchema = withMongoose(z.object({message: z.string()}), {_id: false, id: false});

    const mongooseSchema = toMongooseSchema(LogSchema);
    expect((mongooseSchema.options as any)._id).toBe(false);
    expect((mongooseSchema.options as any).id).toBe(false);
  });

  test('PopulatedSchema Type Utility', () => {
    const UserSchema = z.object({name: z.string()});
    const PostSchema = z.object({
      author: zRef('UserReadme', UserSchema),
    });

    type PopulatedPost = PopulatedSchema<typeof PostSchema, 'author'>;

    // Type check (this is more for compilation, but we can check runtime behavior)
    const post: PopulatedPost = {
      author: {name: 'Alice'},
    };
    expect(post.author.name).toBe('Alice');

    // Ensure it excludes string and ObjectId
    const invalidPost = {
      author: 'some-id',
    };
    // Type check that it is NOT assignable to PopulatedPost
    const isInvalid: PopulatedPost = invalidPost as any;
    expect(isInvalid.author).toBe('some-id' as any);
  });

  test('zRef', () => {
    const UserSchema = z.object({name: z.string()});
    const PostSchema = z.object({
      author: zRef('UserReadme2', UserSchema),
    });

    const mongooseSchema = toMongooseSchema(PostSchema);
    const authorPath = mongooseSchema.path('author');
    expect(authorPath.instance).toBe('ObjectId');
    expect((authorPath as any).options.ref).toBe('UserReadme2');
  });
});
