import {z} from 'zod/v4';
import {
  toMongooseSchema,
  toStrictModel,
  zRef,
  type PopulateObject,
  type PopulateOptions,
  type StrictDocument,
} from '../src/index.js';

const account = z.object({username: z.string()});
const team = z.object({label: z.string()});
const author = z.object({
  name: z.string(),
  user: zRef('ArrayTypeAccount', account),
  team: zRef('ArrayTypeTeam', team),
});
const post = z.object({
  title: z.string(),
  author: zRef('ArrayTypeAuthor', author),
  mentions: z.array(zRef('ArrayTypeAuthor', author)),
  reviewer: zRef('ArrayTypeAuthor', author).optional(),
  untouched: zRef('ArrayTypeAuthor', author),
});
type Post = z.infer<typeof post>;
const Model = toStrictModel(
  'ArrayTypePost',
  toMongooseSchema(post, {
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
  }),
);

export async function checkQueryArrays() {
  const rows = await Model.find()
    .byTitle('Hello')
    .populate([
      {path: 'author', populate: [{path: 'user'}, {path: 'team'}]},
      {path: 'mentions', populate: [{path: 'user'}]},
      {path: 'reviewer'},
    ])
    .byTitle('Hello')
    .exec();
  const doc = rows[0];
  if (!doc || !doc.mentions[0]) return undefined;
  const {username} = doc.author.user;
  const {label} = doc.author.team;
  const mention: string = doc.mentions[0].user.username;
  const reviewer: string | undefined = doc.reviewer?.name;
  const {untouched} = doc;
  const length: number = doc.titleLength();
  // @ts-expect-error Populated fields do not become any.
  doc.author.user.missing();
  // @ts-expect-error Only the requested nested fields are populated.
  doc.mentions[0].team.label.toUpperCase();
  // @ts-expect-error Unselected root references remain IDs.
  doc.untouched.name.toUpperCase();
  // @ts-expect-error Existing method result types are preserved.
  const invalidLength: string = doc.titleLength();
  return {username, label, mention, reviewer, untouched, length, invalidLength};
}

const readonlyOptions = [
  {path: 'author', populate: [{path: 'user'}, {path: 'team'}]},
  {path: 'mentions'},
] as const satisfies PopulateOptions<Post>;

export async function checkDocumentArrays() {
  const raw = await Model.findOne().exec();
  if (!raw) return undefined;
  const doc = await raw.populate(readonlyOptions);
  const {username} = doc.author.user;
  const mention: string | undefined = doc.mentions[0]?.name;
  const length: number = doc.titleLength();
  // @ts-expect-error Document population retains nested field types.
  const invalid: number = doc.author.team.label;
  const nestedObject = await Model.findOne()
    .populate({path: 'author', populate: [{path: 'user'}, {path: 'team'}]})
    .exec();
  const label: string | undefined = nestedObject?.author.team.label;
  return {username, mention, length, invalid, label};
}

export async function checkEmptyRepeatedAndChainedArrays() {
  const empty = await Model.findOne().populate([]).exec();
  if (!empty) return undefined;
  const original: Post['author'] = empty.author;
  const sameDoc = await empty.populate([]);
  const unchanged: Post['mentions'] = sameDoc.mentions;
  const repeated = await Model.findOne()
    .populate([{path: 'author'}, {path: 'author'}])
    .exec();
  if (!repeated) return undefined;
  const repeatedName: string = repeated.author.name;
  // @ts-expect-error Repeating a path does not populate its nested references.
  repeated.author.user.username.toUpperCase();
  const chained = await Model.findOne()
    .populate([{path: 'author'}])
    .populate([{path: 'mentions'}])
    .exec();
  if (!chained) return undefined;
  const {name} = chained.author;
  const mention: string | undefined = chained.mentions[0]?.name;
  return {original, unchanged, repeatedName, name, mention};
}

export async function checkDynamicArrays(options: PopulateObject<Post>[]) {
  const doc = await Model.findOne().populate(options).exec();
  if (!doc) return undefined;
  // A runtime array need not contain the author path. Retain both possibilities.
  const possibleAuthor: Post['author'] | StrictDocument<z.infer<typeof author>> = doc.author;
  // @ts-expect-error A dynamic options array does not guarantee that author was populated.
  doc.author.name.toUpperCase();
  const {title} = doc;
  return {possibleAuthor, title};
}

export function checkInvalidPaths(doc: StrictDocument<Post>) {
  // @ts-expect-error Invalid paths in arrays are rejected.
  Model.findOne().populate([{path: 'missing'}]);
  // @ts-expect-error Invalid nested paths in arrays are rejected.
  Model.findOne().populate([{path: 'author', populate: [{path: 'missing'}]}]);
  // @ts-expect-error Readonly arrays also validate their paths.
  doc.populate([{path: 'missing'}] as const);
}
