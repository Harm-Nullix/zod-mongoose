import {afterEach, describe, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {z} from 'zod/v4';
import {toMongooseSchema, withMongoose} from '../src/index.js';

const connection = mongoose.createConnection();
let index = 0;
function modelFor<T extends z.ZodType>(field: T) {
  return connection.model(`StorageLifecycle${index++}`, toMongooseSchema(z.object({value: field})));
}
afterEach(() => connection.deleteModel(/.*/));

describe('Stored output lifecycle', () => {
  test.each([false, true])('repeated validation does not rerun a non-idempotent transform (output pipe: %j)', async (explicit) => {
    let calls = 0;
    const transform = z.number().transform((value) => { calls++; return value * 2; });
    const field = explicit ? transform.pipe(z.number()) : transform;
    const Model = modelFor(field);
    expect(calls).toBe(0);
    const doc = new Model({value: field.parse(2)});
    await doc.validate();
    await doc.validate();
    expect(doc.value).toBe(4);
    expect(calls).toBe(1);
    doc.value = field.parse(3);
    await doc.validate();
    await doc.validate();
    expect(doc.toObject().value).toBe(6);
    expect(calls).toBe(2);
  });

  test('preprocessing runs at the input boundary rather than on stored output', async () => {
    let calls = 0;
    const field = z.preprocess((value) => { calls++; return Number(value) + 1; }, z.number());
    const Model = modelFor(field);
    const doc = new Model({value: field.parse('2')});
    await doc.validate();
    await doc.validate();
    expect(doc.value).toBe(3);
    expect(calls).toBe(1);
  });

  test('codec output is validated without decoding it again', async () => {
    let calls = 0;
    const field = z.codec(z.string(), z.number().min(0), {
      decode: (value) => { calls++; return Number(value); },
      encode: String,
    });
    const Model = modelFor(field);
    const doc = new Model({value: field.parse('42')});
    await doc.validate();
    await doc.validate();
    expect(doc.value).toBe(42);
    expect(calls).toBe(1);
    doc.value = -1;
    await expect(doc.validate()).rejects.toThrow();
  });

  test('input constraints do not accidentally validate a different output type', async () => {
    const field = z.string().min(4).transform(Number).pipe(z.number().int().min(0));
    const Model = modelFor(field);
    const doc = new Model({value: field.parse('0002')});
    await doc.validate();
    expect(doc.value).toBe(2);
    doc.value = -2;
    await expect(doc.validate()).rejects.toThrow();
  });

  test('refinements after an opaque transform still validate output', async () => {
    const field = z.string().transform(Number).refine((value) => value > 0, 'Must be positive');
    const Model = modelFor(field);
    await new Model({value: field.parse('2')}).validate();
    await expect(new Model({value: -2}).validate()).rejects.toThrow('Must be positive');
  });

  test('object refinements see transformed field output', async () => {
    const input = z.object({
      value: z.string().transform(Number).pipe(z.number()),
      limit: z.number(),
    }).refine(({value, limit}) => value <= limit, 'Above limit');
    const Model = connection.model(`StorageLifecycle${index++}`, toMongooseSchema(input));
    const doc = new Model(input.parse({value: '2', limit: 3}));
    await doc.validate();
    doc.limit = 1;
    await expect(doc.validate()).rejects.toThrow('Above limit');
  });

  test('nested strict output schemas validate generated subdocuments', async () => {
    const field = z.string().transform((text) => ({text})).pipe(z.strictObject({text: z.string()}));
    const Model = modelFor(field);
    const doc = new Model({value: field.parse('hello')});
    await doc.validate();
    await doc.validate();
    expect(doc.toObject().value).toMatchObject({text: 'hello'});
  });

  test('array output schemas validate every assigned element', async () => {
    const field = z.array(z.string().transform(Number).pipe(z.number().min(0)));
    const Model = modelFor(field);
    const doc = new Model({value: field.parse(['1', '2'])});
    await doc.validate();
    expect(doc.toObject().value).toEqual([1, 2]);
    doc.value = [3, -1];
    await expect(doc.validate()).rejects.toThrow();
  });

  test('records retain output value validation', async () => {
    const field = z.record(z.string(), z.string().transform(Number).pipe(z.number().positive()));
    const Model = modelFor(field);
    const doc = new Model({value: field.parse({score: '2'})});
    await doc.validate();
    expect(doc.value).toEqual({score: 2});
    doc.value = {score: -1};
    await expect(doc.validate()).rejects.toThrow();
  });

  test('maps retain output value validation', async () => {
    const field = z.map(z.string(), z.string().transform(Number).pipe(z.number().positive()));
    const Model = modelFor(field);
    const doc = new Model({value: field.parse(new Map([['score', '2']]))});
    await doc.validate();
    expect(doc.value.get('score')).toBe(2);
    doc.value.set('score', -1);
    await expect(doc.validate()).rejects.toThrow();
  });

  test('tuple output supports positional constraints and rest elements', async () => {
    const field = z.tuple([
      z.string().transform(Number).pipe(z.number().positive()), z.boolean(),
    ]).rest(z.string());
    const Model = modelFor(field);
    const doc = new Model({value: field.parse(['2', true, 'extra'])});
    await doc.validate();
    expect(doc.toObject().value).toEqual([2, true, 'extra']);
    doc.set('value', [2, 'true']);
    await expect(doc.validate()).rejects.toThrow();
  });

  test('discriminated union output does not run input transforms', async () => {
    let calls = 0;
    const field = z.discriminatedUnion('kind', [
      z.object({kind: z.literal('count'),
count: z.string().transform((value) => {
        calls++; return Number(value);
      }).pipe(z.number())}),
      z.object({kind: z.literal('name'), name: z.string()}),
    ]);
    const Model = modelFor(field);
    const doc = new Model({value: field.parse({kind: 'count', count: '2'})});
    await doc.validate();
    await doc.validate();
    expect(doc.toObject().value).toMatchObject({kind: 'count', count: 2});
    expect(calls).toBe(1);
  });

  test('async transforms can be parsed before synchronous document validation', async () => {
    let calls = 0;
    const field = z.string().transform(async (value) => { calls++; return Number(value); }).pipe(z.number());
    const Model = modelFor(field);
    const doc = new Model({value: await field.parseAsync('2')});
    await doc.validate();
    expect(doc.value).toBe(2);
    expect(calls).toBe(1);
  });

  test('an opaque transform preserves different output types through assignment', async () => {
    const field = z.string().transform((value) => value === 'true' || value === 'false' ? value === 'true' : value).default(false);
    const Model = modelFor(field);
    const doc = new Model({});
    await doc.validate();
    expect(doc.value).toBe(false);
    doc.value = field.parse('hello');
    await doc.validate();
    expect(doc.value).toBe('hello');
  });

  test('whole-object transforms require an explicit stored shape', async () => {
    const input = z.object({text: z.string()}).transform(({text}) => ({length: text.length}));
    expect(() => toMongooseSchema(input)).toThrow('output object schema');
    const declared = input.pipe(z.strictObject({length: z.number()}));
    const Model = connection.model(`StorageLifecycle${index++}`, toMongooseSchema(declared));
    const doc = new Model(declared.parse({text: 'hello'}));
    await doc.validate();
    expect(doc.length).toBe(5);
  });

  test('recursive objects validate output inside lazy fields and arrays', async () => {
    let calls = 0;
    const node: z.ZodType = z.lazy(() => z.object({
      amount: z.string().transform((value) => { calls++; return Number(value); }).pipe(z.number()),
      children: z.array(node).optional(),
    }));
    const Model = modelFor(node);
    const doc = new Model({value: node.parse({amount: '1', children: [{amount: '2'}]})});
    await doc.validate();
    await doc.validate();
    expect(calls).toBe(2);
    expect(doc.toObject().value).toMatchObject({amount: 1, children: [{amount: 2}]});
  });
});

describe('Native constraints and compatibility', () => {
  test('required strings allow empty values without changing global Mongoose behavior', async () => {
    const Model = modelFor(z.string());
    await new Model({value: ''}).validate();
    await expect(new Model({}).validate()).rejects.toThrow();
    await expect(new Model({value: null}).validate()).rejects.toThrow();
    const Native = connection.model(`NativeString${index++}`, new mongoose.Schema({value: {type: String, required: true}}));
    await expect(new Native({value: ''}).validate()).rejects.toThrow();
  });

  test('discriminator string fields use the same empty-string presence rule', async () => {
    const input = z.discriminatedUnion('kind', [
      z.object({kind: z.literal('text'), text: z.string()}),
      z.object({kind: z.literal('count'), count: z.number()}),
    ]);
    const name = `StorageDiscriminator${index++}`;
    const Model = connection.model(name, toMongooseSchema(input, {modelName: name}));
    await new Model({kind: 'text', text: ''}).validate();
    await expect(new Model({kind: 'text'}).validate()).rejects.toThrow();
  });

  test.each([z.literal(true), z.literal(false), z.literal(42), z.literal('fixed')])('literal constraints still work without the lifecycle hook', async (field) => {
      const Model = connection.model(`NativeLiteral${index++}`, toMongooseSchema(z.object({value: field}), {
        validateBeforeSave: false,
      }));
      await new Model({value: field.value}).validate();
      const wrong = field.value === true ? false : field.value === false ? true : 'wrong';
      await expect(new Model({value: wrong}).validate()).rejects.toThrow();
    },);

  test('null literals accept null but reject omission during document validation', async () => {
    const Model = modelFor(z.literal(null));
    await new Model({value: null}).validate();
    await expect(new Model({}).validate()).rejects.toThrow();
  });

  test('literal constraints compose with metadata validators and type overrides', async () => {
    let calls = 0;
    const Model = modelFor(withMongoose(z.literal('fixed'), {
      type: String,
      validate: () => { calls++; return true; },
    }));
    await new Model({value: 'fixed'}).validate();
    expect(calls).toBe(1);
    await expect(new Model({value: 'wrong'}).validate()).rejects.toThrow();
  });

  test('nullable required arrays accept null while optional arrays preserve omission', async () => {
    const Model = modelFor(z.array(z.string()).nullable());
    await new Model({value: null}).validate();
    await expect(new Model({}).validate()).rejects.toThrow();
    const Optional = modelFor(z.array(z.string()).optional());
    const doc = new Optional({});
    await doc.validate();
    expect(doc.toObject()).not.toHaveProperty('value');
  });

  test.each([z.string().datetime(), z.string().date(), z.iso.datetime(), z.iso.date()])('ISO formats remain strings in both supported syntaxes', async (field) => {
      const value = field.safeParse('2026-01-01').success ? '2026-01-01' : '2026-01-01T00:00:00.000Z';
      const Model = modelFor(field);
      const doc = new Model({value});
      await doc.validate();
      expect(doc.value).toBe(value);
    },);

  test('explicit BSON Binary values are not normalized as Buffer paths', async () => {
    const field = z.instanceof(mongoose.mongo.Binary);
    const Model = modelFor(field);
    const value = new mongoose.mongo.Binary(Buffer.from('data'));
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toBe(value);
  });
});

test('stored outputs survive save, reload, reassignment, and another save', async () => {
  const server = await MongoMemoryServer.create();
  const database = await mongoose.createConnection(server.getUri()).asPromise();
  try {
    let calls = 0;
    const input = z.object({
      amount: z.string().transform((value) => { calls++; return Number(value); }).pipe(z.number().positive()),
      opaque: z.string().transform((value) => ({text: value})),
      tuple: z.tuple([z.string(), z.number(), z.boolean()]),
      state: z.enum({Draft: 1, Published: 2}),
      optionalTags: z.array(z.string()).optional(),
      defaultTags: z.array(z.string().default('element')).default(['outer']),
      values: z.array(z.union([z.string(), z.number(), z.boolean()])),
    });
    const Model = database.model('StorageRoundTrip', toMongooseSchema(input));
    const saved = await Model.create(input.parse({amount: '2', opaque: 'hello', tuple: ['a', 1, true], state: 1, values: ['01', 1, true]}));
    const read = await Model.findById(saved._id).orFail();
    await read.validate();
    expect(read.toObject()).toMatchObject({amount: 2, opaque: {text: 'hello'}, tuple: ['a', 1, true], state: 1, defaultTags: ['outer'], values: ['01', 1, true]});
    expect(read.toObject()).not.toHaveProperty('optionalTags');
    expect(calls).toBe(1);
    read.amount = input.shape.amount.parse('3');
    await read.save();
    const again = await Model.findById(saved._id).orFail();
    await again.validate();
    expect(again.amount).toBe(3);
    expect(calls).toBe(2);
  } finally {
    await database.close();
    await server.stop();
  }
}, 30000);

test('MongoDB $set null retains a nullable value and $unset removes it', async () => {
  const server = await MongoMemoryServer.create();
  const database = await mongoose.createConnection(server.getUri()).asPromise();
  try {
    const input = z.object({value: z.string().nullable().optional()});
    const Model = database.model('NullableUpdate', toMongooseSchema(input));
    const saved = await Model.create({value: 'present'});

    await Model.updateOne({_id: saved._id}, {$set: {value: null}});
    const withNull = await Model.findById(saved._id).lean().orFail();
    expect(Object.hasOwn(withNull, 'value')).toBe(true);
    expect(withNull.value).toBeNull();

    await Model.updateOne({_id: saved._id}, {$unset: {value: 1}});
    const withoutValue = await Model.findById(saved._id).lean().orFail();
    expect(Object.hasOwn(withoutValue, 'value')).toBe(false);
  } finally {
    await database.close();
    await server.stop();
  }
}, 30000);
