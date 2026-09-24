/* eslint-disable no-console */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, withMongoose} from '../src/index.js';

const CoordinatesSchema = z.object({latitude: z.number(), longitude: z.number()});

// A plain nested z.object becomes a Mongoose subschema with its own _id.
const DefaultPlaceSchema = toMongooseSchema(z.object({location: CoordinatesSchema}));
const DefaultPlace = mongoose.model('DefaultPlaceExample', DefaultPlaceSchema);
const defaultPlace = new DefaultPlace({location: {latitude: 52.37, longitude: 4.9}});
assert.ok(defaultPlace._id instanceof mongoose.Types.ObjectId);
assert.ok(defaultPlace.get('location._id') instanceof mongoose.Types.ObjectId);

// Root options affect the root, not the automatically created subschema.
const RootWithoutId = withMongoose(z.object({location: CoordinatesSchema}), {
  _id: false,
  id: false,
});
const RootWithoutIdSchema = toMongooseSchema(RootWithoutId);
assert.equal(RootWithoutIdSchema.path('_id'), undefined);
assert.ok(RootWithoutIdSchema.path('location').schema.path('_id'));

// Keep the subschema but remove its _id (and the id virtual).
const CoordinatesWithoutId = withMongoose(CoordinatesSchema.safeExtend({}), {
  schema: {_id: false, id: false},
});
const PlaceWithoutNestedIdSchema = toMongooseSchema(z.object({location: CoordinatesWithoutId}));
const PlaceWithoutNestedId = mongoose.model('PlaceWithoutNestedIdExample', PlaceWithoutNestedIdSchema);
const placeWithoutNestedId = new PlaceWithoutNestedId({
  location: {latitude: 52.37, longitude: 4.9},
});
assert.ok(placeWithoutNestedId._id instanceof mongoose.Types.ObjectId);
assert.equal(placeWithoutNestedId.get('location._id'), undefined);
assert.equal(PlaceWithoutNestedIdSchema.path('location').schema.options.id, false);

// schema: false produces nested paths instead of a separate subschema.
const CoordinatesAsPaths = withMongoose(CoordinatesSchema.safeExtend({}), {schema: false});
const PlaceWithPathsSchema = toMongooseSchema(z.object({location: CoordinatesAsPaths}));
assert.equal(PlaceWithPathsSchema.path('location'), undefined);
assert.ok(PlaceWithPathsSchema.path('location.latitude'));

console.log('Default: root and nested object have _id');
console.log('Root _id: false: nested object still has _id');
console.log('Nested schema._id: false: only the root has _id');
console.log('schema: false: location uses nested paths');
