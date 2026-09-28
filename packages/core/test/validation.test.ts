import {describe, it, expect} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {extractMongooseDef, toMongooseSchema} from '../src/converter.js';

describe('Zod Validation Mapping to Mongoose Options', () => {
  it('should map string validations (min, max, length, regex)', () => {
    const schema = z.object({
      minStr: z.string().min(5),
      maxStr: z.string().max(10),
      exactStr: z.string().length(7),
      regexStr: z.string().regex(/^[a-z]+$/),
    });

    const def = extractMongooseDef(schema) as any;

    expect(def.minStr.minlength).toBe(5);
    expect(def.maxStr.maxlength).toBe(10);
    // z.string().length(7) maps to both min and max
    expect(def.exactStr.minlength).toBe(7);
    expect(def.exactStr.maxlength).toBe(7);
    expect(def.regexStr.match).toEqual(/^[a-z]+$/);
  });

  it('should map string transformations (trim, lowercase, uppercase)', () => {
    const schema = z.object({
      trimmed: z.string().trim(),
      lowered: z.string().toLowerCase(),
      uppered: z.string().toUpperCase(),
      combined: z.string().trim().toLowerCase(),
    });

    const def = extractMongooseDef(schema) as any;

    expect(def.trimmed.trim).toBe(true);
    expect(def.lowered.lowercase).toBe(true);
    expect(def.uppered.uppercase).toBe(true);
    expect(def.combined.trim).toBe(true);
    expect(def.combined.lowercase).toBe(true);
  });

  it('should map number validations (min, max, positive, negative)', () => {
    const schema = z.object({
      minNum: z.number().min(5),
      maxNum: z.number().max(10),
      posNum: z.number().positive(),
      negNum: z.number().negative(),
    });

    const def = extractMongooseDef(schema) as any;

    expect(def.minNum.min).toBe(5);
    expect(def.maxNum.max).toBe(10);
    expect(def.posNum.min).toBe(0); // positive is > 0, but Mongoose min is >=. Zod positive() might be mapped differently or we use the value.
    expect(def.negNum.max).toBe(0);
  });

  it('should map date validations (min, max)', () => {
    const minDate = new Date('2020-01-01');
    const maxDate = new Date('2030-01-01');
    const schema = z.object({
      rangeDate: z.date().min(minDate).max(maxDate),
    });

    const def = extractMongooseDef(schema) as any;

    expect(def.rangeDate.min).toEqual(minDate);
    expect(def.rangeDate.max).toEqual(maxDate);
  });

  it('should preserve validations through wrappers (optional, nullable, default)', () => {
    const schema = z.object({
      optStr: z.string().trim().min(5).optional(),
      nullNum: z.number().max(10).nullable(),
      defDate: z.date().min(new Date('2020-01-01')).default(new Date()),
    });

    const def = extractMongooseDef(schema) as any;

    expect(def.optStr.trim).toBe(true);
    expect(def.optStr.minlength).toBe(5);
    expect(def.optStr.required).toBe(false);

    expect(def.nullNum.max).toBe(10);

    expect(def.defDate.min).toEqual(new Date('2020-01-01'));
    expect(def.defDate.default).toBeDefined();
  });

  it('allows null and preserves a null default without making nullable fields required in Mongoose', async () => {
    const schema = z.object({
      plain: z.string().nullable(),
      withDefault: z.string().nullable().default(null),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const Model = mongoose.model('NullableNullDefault', mongooseSchema);

    expect(mongooseSchema.path('plain').options.required).toBe(false);
    expect(mongooseSchema.path('withDefault').options.required).toBe(false);
    expect(mongooseSchema.path('withDefault').options.default).toBeNull();

    const document = new Model({plain: null});
    expect(document.get('withDefault')).toBeNull();
    await document.validate();
  });
});
