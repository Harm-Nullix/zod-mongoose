import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, toStrictModel, withMongoose, zRef} from '../src/index.js';

const account = z.object({username: z.string()});
const team = z.object({label: z.string()});
const author = z.object({
  name: z.string(),
  user: zRef('ReviewAccount', account),
  team: zRef('ReviewTeam', team),
});
const post = z.object({
  title: z.string(),
  author: zRef('ReviewAuthor', author),
  mentions: z.array(zRef('ReviewAuthor', author)),
});
const schema = toMongooseSchema(post, {
  methods: {
    titleLength() {
      return this.title.length;
    },
  },
  query: {
    byTitle(title: string) {
      return this.where({title});
    },
  },
});
const Post = toStrictModel('ReviewPost', schema);

export async function checkPathsAndNativeChains() {
  // @ts-expect-error Ordinary fields are not references.
  Post.findOne().populate('title');
  // @ts-expect-error Every space-separated path must be a reference.
  Post.findOne().populate('author title');
  // @ts-expect-error Nested ordinary fields are not references.
  Post.findOne().populate('author.name');
  // @ts-expect-error Ordinary fields cannot start a reference path.
  Post.findOne().populate('title.name');
  const doc = await Post.findOne()
    .where('title')
    .equals('Hello')
    .sort({title: 1})
    .limit(1)
    .select('title author')
    .populate('author')
    .clone()
    .byTitle('Hello')
    .orFail()
    .exec();
  const {name} = doc.author;
  const length: number = doc.titleLength();
  // @ts-expect-error Native fluent overloads retain argument checks.
  Post.findOne().where(42);
  // @ts-expect-error Native chains keep strict population validation.
  Post.findOne().sort({title: 1}).populate('title');
  // @ts-expect-error Populated data is not any.
  doc.author.missing();
  const count: number = await Post.find().countDocuments().exec();
  const distinct: string[] = await Post.find().distinct('title').exec();
  const mapped: string[] = await Post.find()
    .transform((rows) => rows.map((row) => row.title))
    .exec();
  const projected = await Post.findOne().select<{title: string}>('title').exec();
  // @ts-expect-error Explicit projections retain the requested result type.
  projected?.author.toString();
  const lean = await Post.findOne().lean().exec();
  // @ts-expect-error Lean results are not hydrated documents.
  lean?.save();
  return {name, length, count, distinct, mapped};
}

export async function checkRepeatedPopulation() {
  const doc = await Post.findOne()
    .populate([
      {path: 'author', populate: {path: 'user'}},
      {path: 'author', populate: {path: 'team'}},
    ])
    .orFail()
    .exec();
  const {username} = doc.author.user;
  const {label} = doc.author.team;
  const chained = await Post.findOne()
    .populate({path: 'author', populate: {path: 'user'}})
    .sort({title: 1})
    .populate({path: 'author', populate: {path: 'team'}})
    .orFail()
    .exec();
  const chainedUsername: string = chained.author.user.username;
  const chainedLabel: string = chained.author.team.label;
  const replaced = await Post.findOne()
    .populate({path: 'author', populate: {path: 'user'}})
    .populate('author')
    .orFail()
    .exec();
  // @ts-expect-error Replacing an option without nested population clears the nested options.
  replaced.author.user.username.toUpperCase();
  const raw = await Post.findOne().orFail().exec();
  const document = await raw.populate([
    {path: 'author', populate: {path: 'user'}},
    {path: 'author', populate: {path: 'team'}},
  ]);
  const documentLabel: string = document.author.team.label;
  // @ts-expect-error Documents use the last root option, unlike query option merging.
  document.author.user.username.toUpperCase();
  const repopulated = await document.populate({path: 'author', populate: {path: 'user'}});
  const repopulatedName: string = repopulated.author.user.username;
  return {username, label, chainedUsername, chainedLabel, documentLabel, repopulatedName};
}

export async function checkDocumentFactories() {
  const created = await Post.create({title: 'Hello'});
  const populated = await created.populate([{path: 'author'}]);
  const authorName: string = populated.author.name;
  const length: number = populated.titleLength();
  const constructed = await new Post({title: 'Hello'}).populate('author');
  const hydrated = await Post.hydrate({title: 'Hello'}).populate('author');
  const inserted = await Post.insertOne({title: 'Hello'});
  const insertedPopulated = await inserted.populate('author');
  const many = await Post.create([{title: 'Hello'}]);
  const variadic = await Post.create({title: 'Hello'}, {title: 'Again'});
  const empty: null = await Post.create();
  const aggregate = await Post.create([{title: 'Hello'}], {aggregateErrors: true});
  const item = aggregate[0];
  if (item && !(item instanceof mongoose.Error)) await item.populate('author');
  const bulk = await Post.insertMany([{title: 'Hello'}]);
  if (bulk[0]) await bulk[0].populate('author');
  const lean = await Post.insertMany([{title: 'Hello'}], {lean: true});
  // @ts-expect-error Lean inserts do not return hydrated documents.
  lean[0]?.populate('author');
  // @ts-expect-error Created documents validate reference paths.
  created.populate('title');
  const raw = await Post.insertMany([{title: 'Hello'}], {rawResult: true});
  const count: number = raw.insertedCount;
  return {
    authorName,
    length,
    constructed,
    hydrated,
    insertedPopulated,
    many,
    variadic,
    empty,
    count,
  };
}

export function checkLiteralSchemaOptions() {
  const value = z.object({name: z.string()});
  const schema = toMongooseSchema(value, {
    timestamps: true,
    _id: false,
    id: false,
    versionKey: false,
  });
  const Native = mongoose.model('ReviewOptions', schema);
  const doc = new Native();
  const created: Date = doc.createdAt;
  const serializedDate: Date = doc.toObject().createdAt;
  // @ts-expect-error Serialized results also omit generated IDs when disabled.
  doc.toJSON()._id.toString();
  const updated: Date = doc.updatedAt;
  // @ts-expect-error Disabling _id removes the generated ID.
  doc._id.toString();
  // @ts-expect-error Disabling id removes the virtual.
  doc.id.toString();
  // @ts-expect-error Disabling versionKey removes the generated version.
  doc.__v.toFixed(0);
  const Strict = toStrictModel('ReviewStrictOptions', schema);
  const strictDoc = new Strict();
  const strictCreated: Date = strictDoc.createdAt;
  // @ts-expect-error Strict models also preserve disabled IDs.
  strictDoc._id.toString();
  const renamed = toMongooseSchema(value, {
    timestamps: {createdAt: 'created_on', updatedAt: false},
    versionKey: 'revision',
  });
  const Renamed = mongoose.model('ReviewRenamed', renamed);
  const renamedDoc = new Renamed();
  const renamedDate: Date = renamedDoc.created_on;
  const {revision} = renamedDoc;
  // @ts-expect-error The default timestamp name is not generated when renamed.
  renamedDoc.createdAt.toISOString();
  // @ts-expect-error An individually disabled timestamp is not generated.
  renamedDoc.updatedAt.toISOString();
  const meta = withMongoose(value, {timestamps: true, _id: false});
  const Meta = mongoose.model('ReviewMetadata', toMongooseSchema(meta));
  const metaDate: Date = new Meta().createdAt;
  // @ts-expect-error Metadata also disables generated IDs.
  new Meta()._id.toString();
  const Override = mongoose.model(
    'ReviewOverride',
    toMongooseSchema(meta, {timestamps: false, _id: true}),
  );
  const id: mongoose.Types.ObjectId = new Override()._id;
  // @ts-expect-error Explicit options override metadata.
  new Override().createdAt.toISOString();
  const Replaced = mongoose.model(
    'ReviewReplacedMetadata',
    toMongooseSchema(withMongoose(meta, {timestamps: false})),
  );
  // @ts-expect-error Later withMongoose metadata replaces earlier values.
  new Replaced().createdAt.toISOString();
  return {serializedDate, created, updated, strictCreated, renamedDate, revision, metaDate, id};
}

export async function checkLeanPopulation() {
  const before = await Post.findOne()
    .lean()
    .sort({title: 1})
    .populate({path: 'author', populate: {path: 'user'}})
    .orFail();
  const after = await Post.findOne()
    .populate({path: 'author', populate: {path: 'user'}})
    .lean()
    .orFail();
  const first: string = before.author.user.username;
  const second: string = after.author.user.username;
  // @ts-expect-error Lean root documents do not have instance methods.
  before.titleLength();
  // @ts-expect-error Lean root documents do not have save().
  after.save();
  // @ts-expect-error Nested populations are also lean.
  before.author.save();
  const restored = await Post.findOne().lean().populate('author').lean(false).orFail();
  restored.titleLength();
  restored.author.save();
  const explicit = await Post.findOne().lean<{title: string}>().exec();
  // @ts-expect-error An explicit lean override retains its projected shape.
  explicit?.author.toString();
  const retainsNull: null extends typeof explicit ? true : false = true;
  return {first, second, retainsNull};
}

export async function checkQueryOperationChanges() {
  const query = Post.find().populate('author');
  const one = await query.findOne({title: 'Hello'}).sort({title: 1}).orFail();
  const {name}: {name: string} = one.author;
  const many = await Post.findOne().find({title: 'Hello'}).populate('author').exec();
  const first: string | undefined = many[0]?.author.name;
  const nested = await one.author.populate('user');
  const {username}: {username: string} = nested.user;
  // @ts-expect-error orFail makes this a document, not an array.
  one.map(() => 1);
  return {name, first, username};
}

export function checkOrdinaryObjectFields() {
  const schema = z.object({
    name: z.string(),
    config: z.object({}),
    anything: z.any(),
    author: zRef('ReviewAuthor', author),
  });
  const Model = toStrictModel('ReviewOrdinaryFields', toMongooseSchema(schema));
  // @ts-expect-error An empty object is not a reference.
  Model.findOne().populate('config');
  // @ts-expect-error any cannot prove that a field is a reference.
  Model.findOne().populate('anything');
}

export function checkGeneratedFieldsPreserveExtensions() {
  const Model = toStrictModel(
    'ReviewGeneratedExtensions',
    toMongooseSchema(post, {
      timestamps: true,
      methods: {
        titleLength() {
          return this.title.length;
        },
      },
    }),
  );
  const doc = new Model();
  const date: Date = doc.createdAt;
  const length: number = doc.titleLength();
  // @ts-expect-error Timestamp inference must not degrade to any.
  const invalid: number = doc.toObject().createdAt;
  const CustomId = mongoose.model(
    'ReviewExplicitId',
    toMongooseSchema(z.object({_id: z.string(), name: z.string()}), {_id: false}),
  );
  const id: string = new CustomId()._id;
  return {date, length, invalid, id};
}
