import {describe, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, zPoint, zPolygon} from '../src/index.js';
import * as Frontend from '../src/index.frontend.js';

const point = {type: 'Point' as const, coordinates: [4.9, 52.3]};
const polygon = {
  type: 'Polygon' as const,
  coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]],
};

describe('GeoJSON helpers', () => {
  test('validate two-dimensional GeoJSON shapes in both entry points', () => {
    for (const helpers of [{zPoint, zPolygon}, Frontend]) {
      expect(helpers.zPoint().safeParse(point).success).toBe(true);
      expect(helpers.zPoint().safeParse({type: 'Polygon', coordinates: [4.9, 52.3]}).success).toBe(false);
      expect(helpers.zPoint().safeParse({type: 'Point', coordinates: [4.9]}).success).toBe(false);
      expect(helpers.zPolygon().safeParse(polygon).success).toBe(true);
      expect(helpers.zPolygon().safeParse({type: 'Polygon', coordinates: []}).success).toBe(false);
      expect(helpers.zPolygon().safeParse({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 0]]],
      }).success).toBe(false);
      expect(helpers.zPolygon().safeParse({
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [1, 1]]],
      }).success).toBe(false);
    }
  });

  test('rejects malformed positions and validates every Polygon ring', () => {
    const secondRing = [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 0.5]];

    for (const helpers of [{zPoint, zPolygon}, Frontend]) {
      const pointSchema = helpers.zPoint();
      for (const coordinates of [
        [4.9, 52.3, 10],
        ['4.9', 52.3],
        [Number.NaN, 52.3],
        [Number.POSITIVE_INFINITY, 52.3],
      ]) {
        expect(pointSchema.safeParse({type: 'Point', coordinates}).success).toBe(false);
      }

      const polygonSchema = helpers.zPolygon();
      expect(polygonSchema.safeParse({
        type: 'Polygon',
        coordinates: [polygon.coordinates[0], secondRing],
      }).success).toBe(true);
      expect(polygonSchema.safeParse({
        type: 'Polygon',
        coordinates: [polygon.coordinates[0], [[0.5, 0.5], [1, 0.5], [1, 1], [0.6, 0.6]]],
      }).success).toBe(false);
      expect(polygonSchema.safeParse({
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0, 1]]],
      }).success).toBe(false);
    }
  });

  test('converts both shapes to GeoJSON Mongoose subdocuments', () => {
    const schema = toMongooseSchema(z.object({
      location: zPoint({index: '2dsphere'}),
      boundary: zPolygon(),
    }));

    expect(schema.path('location').isRequired).toBe(true);
    expect(schema.path('location').options.index).toBe('2dsphere');
    expect(schema.indexes()).toContainEqual([{location: '2dsphere'}, {}]);
    expect(schema.path('location.type').instance).toBe('String');
    expect(schema.path('location.type').options.enum).toEqual(['Point']);
    expect(schema.path('location.type').isRequired).toBe(true);
    expect(schema.path('location.coordinates').instance).toBe('Array');
    expect(schema.path('location.coordinates').options.type).toEqual([Number]);
    expect(schema.path('location.coordinates').isRequired).toBe(true);
    expect(schema.path('location._id')).toBeUndefined();

    expect(schema.path('boundary.type').options.enum).toEqual(['Polygon']);
    expect(schema.path('boundary.coordinates').instance).toBe('Array');
    expect(schema.path('boundary.coordinates').options.type).toEqual([[[Number]]]);
    expect(schema.path('boundary.coordinates').options.minlength).toBeUndefined();
    expect(schema.path('boundary.coordinates').isRequired).toBe(true);
    expect(schema.path('boundary._id')).toBeUndefined();
  });

  test('validates Mongoose documents and supports optional GeoJSON fields', async () => {
    const schema = toMongooseSchema(z.object({
      name: z.string(),
      location: zPoint().optional(),
      boundary: zPolygon(),
    }));
    const Model = mongoose.model('GeoJsonHelperTest', schema);

    expect(schema.path('location').isRequired).toBe(false);
    await expect(new Model({name: 'City', boundary: polygon}).validate()).resolves.toBeUndefined();
    await expect(new Model({name: 'City', location: point, boundary: polygon}).validate()).resolves.toBeUndefined();
    await expect(new Model({
      name: 'City',
      location: point,
      boundary: {type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [1, 1]]]},
    }).validate()).rejects.toThrow();
  });

  test('rejects missing required geometry and empty coordinates after Mongoose casting', async () => {
    const schema = toMongooseSchema(z.object({location: zPoint(), boundary: zPolygon()}));
    const Model = mongoose.model('GeoJsonRequiredTest', schema);

    await expect(new Model({boundary: polygon}).validate()).rejects.toThrow();
    await expect(new Model({location: point, boundary: {type: 'Polygon'}}).validate()).rejects.toThrow();
    await expect(new Model({
      location: {type: 'Point', coordinates: []},
      boundary: polygon,
    }).validate()).rejects.toThrow();
    await expect(new Model({
      location: point,
      boundary: {type: 'Polygon', coordinates: []},
    }).validate()).rejects.toThrow();
  });

  test('preserves GeoJSON validation and omits subdocument IDs in arrays', async () => {
    const schema = toMongooseSchema(z.object({locations: z.array(zPoint())}));
    const Model = mongoose.model('GeoJsonArrayTest', schema);
    const document = new Model({locations: [point, {type: 'Point', coordinates: [-73.9, 40.7]}]});

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.toObject().locations?.[0]).not.toHaveProperty('_id');
    expect(document.toObject().locations?.[1]).not.toHaveProperty('_id');
    await expect(new Model({
      locations: [point, {type: 'Point', coordinates: [1]}],
    }).validate()).rejects.toThrow();
  });
});
