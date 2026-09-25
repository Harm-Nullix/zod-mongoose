import {z} from 'zod/v4';
import {withMongoose, type MongooseMeta} from './registry.js';

const position = z.tuple([z.number(), z.number()]);

/** A two-dimensional GeoJSON Point, with a Mongoose subdocument definition. */
export const zPoint = (options?: MongooseMeta) => withMongoose(
  z.object({
    type: withMongoose(z.literal('Point'), {type: String, enum: ['Point'], required: true}),
    coordinates: withMongoose(position, {required: true}),
  }),
  {schema: {_id: false}, required: true, ...options},
);

/** A two-dimensional GeoJSON Polygon. Each linear ring must be closed. */
export const zPolygon = (options?: MongooseMeta) => withMongoose(
  z.object({
    type: withMongoose(z.literal('Polygon'), {type: String, enum: ['Polygon'], required: true}),
    coordinates: withMongoose(
      z.array(
        z.array(position).refine(
          (ring) => ring.length >= 4 &&
            ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1],
          'Polygon rings must be closed',
        ),
      ).refine((rings) => rings.length > 0, 'Polygon must have at least one ring'),
      {required: true},
    ),
  }),
  {schema: {_id: false}, required: true, ...options},
);
