import {describe, expect, test} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {toMongooseSchema, withMongoose, zObjectId} from '../src/index.js';

describe('Zod object modes', () => {
  test('persists typed catchall fields and rejects invalid extras', async () => {
    const server = await MongoMemoryServer.create();
    try {
      await mongoose.connect(server.getUri());
      const definition = z.object({name: z.string(), age: z.number()}).catchall(z.string());
      const Model = mongoose.model('CatchallPersistence', toMongooseSchema(definition)) as any;

      const saved = await Model.create({name: 'Ada', age: 37, nickname: 'A'});
      await saved.validate(); // A saved document also has Mongoose's __v field.
      const read = await Model.findById(saved._id).lean();
      expect(read?.nickname).toBe('A');

      const invalid = new Model({name: 'Ada', age: 37, nickname: 42});
      expect(invalid.toObject()).toHaveProperty('nickname', 42);
      await expect(invalid.validate()).rejects.toThrow('nickname');

      const EmptyModel = mongoose.model(
        'CatchallEmptyPersistence',
        toMongooseSchema(z.object({name: z.string()}).catchall(z.object({}))),
      ) as any;
      const emptySaved = await EmptyModel.create({name: 'Ada', notes: {}});
      const emptyRead = await EmptyModel.findById(emptySaved._id).lean();
      expect(emptyRead?.notes).toEqual({});

      const StrictModel = mongoose.model(
        'StrictCustomVersion',
        toMongooseSchema(z.strictObject({name: z.string()}), {versionKey: 'revision'}),
      );
      const strictSaved = await StrictModel.create({name: 'Ada'});
      expect(strictSaved.toObject()).toHaveProperty('revision', 0);
      await strictSaved.validate();

      const TimestampModel = mongoose.model(
        'StrictGeneratedTimestamps',
        toMongooseSchema(z.strictObject({name: z.string()}), {
          timestamps: {createdAt: 'created_at', updatedAt: 'updated_at'},
        }),
      );
      const timestampSaved = await TimestampModel.create({name: 'Ada'});
      expect(timestampSaved.toObject()).toHaveProperty('created_at');
      await timestampSaved.validate();
    } finally {
      await mongoose.disconnect();
      await server.stop();
    }
  });

  test('preserves loose fields at root and in subdocuments', async () => {
    const definition = z.looseObject({
      name: z.string(),
      profile: z.looseObject({city: z.string()}),
    });
    const schema = toMongooseSchema(definition);
    const Model = mongoose.model('LooseObjectModes', schema);
    const document = new Model({name: 'Ada', extra: true, profile: {city: 'Utrecht', code: 42}});

    expect(schema.options.strict).toBe(false);
    expect((schema.path('profile') as any).schema.options.strict).toBe(false);
    expect(document.toObject()).toMatchObject({extra: true, profile: {code: 42}});
    await document.validate();
  });

  test('keeps empty dynamic objects instead of minimizing them away', async () => {
    const definition = z.object({
      child: z.looseObject({name: z.string()}),
    }).catchall(z.object({}));
    const schema = toMongooseSchema(definition);
    const Model = mongoose.model('EmptyDynamicObjects', schema);
    const document = new Model({empty: {}, child: {name: 'Ada', empty: {}}});

    expect(schema.options.minimize).toBe(false);
    expect((schema.path('child') as any).schema.options.minimize).toBe(false);
    expect(document.toObject().empty).toEqual({});
    expect(document.toObject().child.empty).toEqual({});
    await document.validate();
  });

  test('validates typed catchall fields inside subdocuments and arrays', async () => {
    const child = z.object({name: z.string()}).catchall(z.number());
    const Model = mongoose.model(
      'NestedCatchallModes',
      toMongooseSchema(z.object({child, children: z.array(child)})),
    );
    const valid = new Model({
      child: {name: 'A', score: 2},
      children: [{name: 'B', score: 3}],
    });
    expect(valid.get('child.score')).toBe(2);
    expect(valid.get('children.0.score')).toBe(3);
    await valid.validate();

    const invalid = new Model({child: {name: 'A', score: 'wrong'}});
    await expect(invalid.validate()).rejects.toThrow('score');
  });

  test('rejects unknown keys for strict objects and accepts generated IDs', async () => {
    const definition = z.strictObject({
      name: z.string(),
      child: z.strictObject({label: z.string()}),
    });
    const schema = toMongooseSchema(definition);
    const Model = mongoose.model('StrictObjectModes', schema);

    expect(schema.options.strict).toBe('throw');
    expect((schema.path('child') as any).schema.options.strict).toBe('throw');
    await new Model({name: 'Ada', child: {label: 'A'}}).validate();
    expect(() => new Model({name: 'Ada', child: {label: 'A'}, extra: true})).toThrow();
    await expect(new Model({name: 'Ada', child: {label: 'A', extra: true}}).validate())
      .rejects.toThrow('child');

    const WithId = mongoose.model(
      'StrictObjectWithId',
      toMongooseSchema(z.strictObject({_id: zObjectId(), name: z.string()})),
    );
    await new WithId({name: 'Ada'}).validate();
  });

  test('finds nested strict subdocuments inside ordinary nested paths', async () => {
    const parent = withMongoose(
      z.object({child: z.strictObject({name: z.string()})}),
      {schema: false},
    );
    const Model = mongoose.model('StrictInsidePaths', toMongooseSchema(z.object({parent})));
    await new Model({parent: {child: {name: 'Ada'}}}).validate();
    await expect(new Model({parent: {child: {name: 'Ada', extra: true}}}).validate())
      .rejects.toThrow('child');
  });

  test('retains derived object modes and supports explicit strict overrides', async () => {
    const base = z.looseObject({name: z.string(), age: z.number().optional()});
    const derived = base.pick({name: true}).safeExtend({city: z.string()});
    const Model = mongoose.model('DerivedObjectModes', toMongooseSchema(derived));
    const document = new Model({name: 'Ada', city: 'Utrecht', extra: 1});
    expect(document.toObject()).toHaveProperty('extra', 1);
    await document.validate();

    const override = toMongooseSchema(base, {strict: true});
    expect(override.options.strict).toBe(true);
    const strictFromMetadata = toMongooseSchema(withMongoose(z.looseObject({name: z.string()}), {strict: true}));
    expect(strictFromMetadata.options.strict).toBe(true);
  });

  test('rejects schema: false for nested objects whose mode needs a subschema', () => {
    const child = withMongoose(z.object({name: z.string()}).catchall(z.string()), {schema: false});
    expect(() => toMongooseSchema(z.object({child}))).toThrow('needs a Mongoose subschema');
  });

  test('maps required and exact optional fields to their underlying types', async () => {
    const definition = z.object({
      name: z.string().optional(),
      nickname: z.string().exactOptional(),
    }).required({name: true});
    const schema = toMongooseSchema(definition);
    const Model = mongoose.model('ObjectFieldWrappers', schema);

    expect(schema.path('name').instance).toBe('String');
    expect(schema.path('name').isRequired).toBe(true);
    expect(schema.path('nickname').instance).toBe('String');
    expect(schema.path('nickname').isRequired).toBe(false);
    await expect(new Model({}).validate()).rejects.toThrow('name');
    await new Model({name: 'Ada'}).validate();
    await expect(new Model({name: 'Ada', nickname: undefined}).validate())
      .rejects.toThrow('nickname');

    const optionalAgain = z.object({name: z.string().optional()}).required().partial();
    const OptionalModel = mongoose.model('OptionalAfterRequired', toMongooseSchema(optionalAgain));
    expect(OptionalModel.schema.path('name').isRequired).toBe(false);
    await new OptionalModel({}).validate();

    const nullableRequired = z.object({value: z.string().nullable().optional()}).required();
    const NullableModel = mongoose.model('NullableRequired', toMongooseSchema(nullableRequired));
    expect(NullableModel.schema.path('value').instance).toBe('String');
    await new NullableModel({value: null}).validate();
    await expect(new NullableModel({}).validate()).rejects.toThrow('value');

    const nestedRequired = z.object({child: z.object({name: z.string()}).optional()}).required();
    const NestedModel = mongoose.model('NestedRequired', toMongooseSchema(nestedRequired));
    expect(NestedModel.schema.path('child').isRequired).toBe(true);
    await expect(new NestedModel({}).validate()).rejects.toThrow('child');
  });
});
