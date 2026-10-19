import {afterEach, describe, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, withMongoose} from '../src/index.js';

// Regression coverage for schema conversion and stored-value compatibility.
// validate() exercises the validation middleware used by save(), without MongoDB.
// Sources and the distinction between confirmed bugs and roadmap proposals:
// ./roadmap-3.4.md
const connection = mongoose.createConnection();
let modelIndex = 0;

function modelFor(field: z.ZodType, options: {validateBeforeSave?: boolean} = {}) {
  const schema = toMongooseSchema(z.object({value: field}), options);
  return connection.model(`Roadmap34_${modelIndex++}`, schema);
}

afterEach(() => {
  connection.deleteModel(/.*/);
});

describe('Mongoose behavior controls', () => {
  test('native required arrays accept [] under the default checkRequired', async () => {
    const Model = connection.model(`Roadmap34_${modelIndex++}`, new mongoose.Schema({
      value: {type: [String], required: true},
    }));
    const doc = new Model({value: []});
    await doc.validate();
  });

  test.each([null, 'draft', 'published'])('nullable string enums accept %j', async (value) => {
    const field = z.enum(['draft', 'published']).nullable();
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    expect(Model.schema.path('value').options.required).toBe(false);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toBe(value);
  });

  test('nullable enums still reject an undeclared string', async () => {
    const field = z.enum(['draft', 'published']).nullable();
    expect(field.safeParse('other').success).toBe(false);
    const Model = modelFor(field);
    await expect(new Model({value: 'other'}).validate()).rejects.toThrow();
  });

  test.each([
    ['string first', z.union([z.string(), z.number()]), 42],
    ['number first', z.union([z.number(), z.string()]), '0042'],
    ['boolean first', z.union([z.boolean(), z.number()]), 1],
    ['number first with boolean', z.union([z.number(), z.boolean()]), false],
    ['date first', z.union([z.date(), z.string()]), '2026-01-01'],
  ])('primitive Union preserves an exact match: %s', async (_label, field, value) => {
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    expect(doc.value).toBe(value);
    await doc.validate();
    expect(doc.value).toBe(value);
  });
});

describe('Array presence, defaults, and element boundaries', () => {
  test.each([
    ['plain', z.array(z.string())],
    ['min(0)', z.array(z.string()).min(0)],
    ['length(0)', z.array(z.string()).length(0)],
    ['optional elements', z.array(z.string().optional())],
  ])('accepts valid empty arrays: %s', async (_label, field) => {
    expect(field.safeParse([]).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value: []});
    await doc.validate();
    expect(doc.value).toEqual([]);
  });

  test('a required array rejects omission instead of manufacturing []', async () => {
    const field = z.array(z.string());
    expect(z.object({value: field}).safeParse({}).success).toBe(false);
    const Model = modelFor(field);
    await expect(new Model({}).validate()).rejects.toThrow();
  });

  test('an optional array preserves omission', async () => {
    const field = z.array(z.string()).optional();
    const expected = z.object({value: field}).parse({});
    const Model = modelFor(field);
    const doc = new Model({});
    await doc.validate();
    expect(doc.toObject().value).toBe(expected.value);
  });

  test.each([z.array(z.string()).min(1), z.array(z.string()).min(2)])('enforces array length during lifecycle validation', async (field) => {
      expect(field.safeParse([]).success).toBe(false);
      const Model = modelFor(field);
      await expect(new Model({value: []}).validate()).rejects.toThrow();
    },);

  test('an optional element does not make the containing array optional', async () => {
    const field = z.array(z.string().optional());
    expect(z.object({value: field}).safeParse({}).success).toBe(false);
    const Model = modelFor(field);
    await expect(new Model({}).validate()).rejects.toThrow();
  });

  test('element defaults do not overwrite the array default', async () => {
    const field = z.array(z.string().default('element')).default(['outer']);
    const expected = z.object({value: field}).parse({});
    const Model = modelFor(field);
    const doc = new Model({});
    await doc.validate();
    expect(doc.value).toEqual(expected.value);
  });

  test('string element min length does not become an array string validator', async () => {
    const field = z.array(z.string().min(2));
    const value = ['ab', 'cd'];
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toEqual(value);
  });

  test('element validation remains effective', async () => {
    const field = z.array(z.string().min(2));
    expect(field.safeParse(['a']).success).toBe(false);
    const Model = modelFor(field);
    await expect(new Model({value: ['a']}).validate()).rejects.toThrow();
  });

  test('nullable enum elements do not turn the whole array into an enum', async () => {
    const field = z.array(z.enum(['draft', 'published']).nullable());
    const value = [null, 'draft'];
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toEqual(value);
  });
});

describe('Transform output and lifecycle alignment', () => {
  test.each([
    ['string to number', z.string().transform(Number), '0042'],
    ['number to string', z.number().transform(String), 42],
    ['string to boolean', z.string().transform((value) => value.length > 0), 'yes'],
    ['string to date', z.string().transform((value) => new Date(value)), '2026-01-01'],
    ['string to object', z.string().transform((value) => ({text: value})), 'hello'],
    ['string to array', z.string().transform((value) => value.split(',')), 'a,b'],
  ])('preserves already parsed output without input-type casting: %s', async (_label, field, input) => {
    const expected = field.parse(input);
    // Isolate the casting failure from the separate post-validate failure below.
    const Model = modelFor(field, {validateBeforeSave: false});
    const doc = new Model({value: expected});
    await doc.validate();
    expect(doc.toObject().value).toEqual(expected);
  });

  test('an explicit output schema maps to Number', () => {
    const Model = modelFor(z.string().transform(Number).pipe(z.number()));
    expect(Model.schema.path('value').instance).toBe('Number');
  });

  test('lifecycle validation accepts already parsed output with an explicit output schema', async () => {
    const field = z.string().transform(Number).pipe(z.number());
    const value = field.parse('42');
    const Model = modelFor(field);
    const doc = new Model({value});
    expect(doc.value).toBe(value);
    await doc.validate();
  });

  test('lifecycle validation accepts already parsed output with a type override', async () => {
    const field = withMongoose(z.string().transform(Number), {type: Number});
    const value = field.parse('42');
    const Model = modelFor(field);
    const doc = new Model({value});
    expect(doc.value).toBe(value);
    await doc.validate();
  });

  test('explicit parsing stores a same-type transform without rerunning it', async () => {
    const field = z.string().transform((value) => value.trim());
    const Model = modelFor(field);
    const doc = new Model({value: field.parse('  hello  ')});
    await doc.validate();
    expect(doc.toObject().value).toBe(field.parse('  hello  '));
  });
});

describe('Unions: explicit parsing and Mongoose casting', () => {
  test.each([
    ['number first', z.union([z.number(), z.boolean()]), '1'],
    ['boolean first', z.union([z.boolean(), z.number()]), 'true'],
    ['literal first', z.union([z.literal('fixed'), z.number()]), 'other'],
  ])('explicit parsing rejects invalid input before Mongoose casting: %s', (_label, field, value) => {
    expect(field.safeParse(value).success).toBe(false);
    expect(() => field.parse(value)).toThrow();
  });

  test('arrays of primitive unions can compile and retain each element type', async () => {
    const field = z.array(z.union([z.string(), z.number(), z.boolean()]));
    const value = ['0042', 42, true];
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.toObject().value).toEqual(value);
  });

  test('union query casting retains native Mongoose numeric string coercion', () => {
    const Model = modelFor(z.union([z.number(), z.boolean()]));
    const query = Model.findOne({value: '1'});
    query.cast(Model);
    expect(query.getFilter().value).toBe(1);
  });

  test('direct construction retains native Mongoose union coercion', async () => {
    const Model = modelFor(z.union([z.number(), z.boolean()]));
    const doc = new Model({value: '1'});
    await doc.validate();
    expect(doc.value).toBe(1);
  });
});

describe('Literals: native constraints and explicit defaults', () => {
  test.each([
    ['string', 'fixed', String],
    ['number', 42, Number],
    ['boolean', true, Boolean],
  ])('maps a %s literal to its native type without inventing a default', (_label, value, type) => {
    const Model = modelFor(z.literal(value));
    const path = Model.schema.path('value');
    expect(path.options.type).toBe(type);
    if (type !== Boolean) expect(path.options.enum).toEqual([value]);
    expect(path.options.default).toBeUndefined();
  });

  test.each(['fixed', 42, true])('requires a literal %j unless defaulted explicitly', async (value) => {
    expect(z.object({value: z.literal(value)}).safeParse({}).success).toBe(false);
    const Model = modelFor(z.literal(value));
    await expect(new Model({}).validate()).rejects.toThrow();
  });

  test('rejects a wrong literal with the Zod hook enabled', async () => {
    const Model = modelFor(z.literal('fixed'));
    await expect(new Model({value: 'wrong'}).validate()).rejects.toThrow();
  });

  test('a string literal constraint also works without the Zod hook', async () => {
    const Model = modelFor(z.literal('fixed'), {validateBeforeSave: false});
    await expect(new Model({value: 'wrong'}).validate()).rejects.toThrow();
  });

  test('optional literals preserve omission instead of receiving an implicit default', async () => {
    const Model = modelFor(z.literal('fixed').optional());
    const doc = new Model({});
    await doc.validate();
    expect(doc.value).toBeUndefined();
  });

  test('an explicit Zod literal default is already honored', async () => {
    const Model = modelFor(z.literal('fixed').default('fixed'));
    const doc = new Model({});
    await doc.validate();
    expect(doc.value).toBe('fixed');
  });

  test.each([null, 'fixed'])('nullable literals preserve %j', async (value) => {
    const Model = modelFor(z.literal('fixed').nullable());
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toBe(value);
  });

  test.each(['draft', 'published'])('multi-value literals preserve %j', async (value) => {
    const Model = modelFor(z.literal(['draft', 'published']));
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toBe(value);
  });
});

describe('Related primitive runtime compatibility', () => {
  test.each([z.string(), z.string().min(0), z.enum(['', 'fixed'])])('accepts the empty string when Zod allows it', async (field) => {
      expect(field.safeParse('').success).toBe(true);
      const Model = modelFor(field);
      const doc = new Model({value: ''});
      await doc.validate();
      expect(doc.value).toBe('');
    },);

  test('nonempty strings still reject an empty string', async () => {
    const Model = modelFor(z.string().min(1));
    await expect(new Model({value: ''}).validate()).rejects.toThrow();
  });

  test.each([null, 1, 2])('numeric nullable enums preserve %j', async (value) => {
    const field = z.enum({Draft: 1, Published: 2}).nullable();
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toBe(value);
  });

  test('ISO datetime strings remain strings through document validation', async () => {
    const field = z.iso.datetime();
    const value = '2026-01-01T00:00:00.000Z';
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.value).toBe(value);
  });

  test('heterogeneous tuple elements retain their individual types', async () => {
    const field = z.tuple([z.string(), z.number(), z.boolean()]);
    const value = ['hello', 42, true];
    expect(field.safeParse(value).success).toBe(true);
    const Model = modelFor(field);
    const doc = new Model({value});
    await doc.validate();
    expect(doc.toObject().value).toEqual(value);
  });
});
