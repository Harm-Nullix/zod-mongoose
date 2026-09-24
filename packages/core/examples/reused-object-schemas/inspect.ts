/* eslint-disable no-console */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {UserMongooseSchema, AuditMongooseSchema} from './models.js';

const User = mongoose.model('ReusableUserExample', UserMongooseSchema);
const Audit = mongoose.model('ReusableAuditExample', AuditMongooseSchema);
const address = {street: 'Main Street', city: 'Amsterdam'};

const user = new User({
  name: 'Ada',
  shippingAddress: address,
  previousAddresses: [address],
});
const audit = new Audit({addressSnapshot: address});

assert.ok(user._id instanceof mongoose.Types.ObjectId);
assert.equal(user.get('shippingAddress._id'), undefined);
assert.equal(user.get('previousAddresses.0._id'), undefined);
assert.ok(audit.get('addressSnapshot._id') instanceof mongoose.Types.ObjectId);

assert.equal(UserMongooseSchema.path('shippingAddress').schema.path('_id'), undefined);
assert.equal(UserMongooseSchema.path('previousAddresses').schema.path('_id'), undefined);
assert.ok(AuditMongooseSchema.path('addressSnapshot').schema.path('_id'));

console.log('User: root has _id; shippingAddress and previousAddresses do not');
console.log('Audit: addressSnapshot still has _id');
