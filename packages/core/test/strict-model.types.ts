import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, toStrictModel, zRef, type ToMongooseSchemaOptions} from '../src/index.js';

const author = z.object({name: z.string()});
const user = z.object({name: z.string(), author: zRef('TypedAuthor', author)});
type User = z.infer<typeof user>;
const schema = toMongooseSchema(user, {
  query: {
    byName(name: string) {
      return this.where({name});
    },
  },
  methods: {
    greet() {
      return this.name;
    },
  },
  statics: {
    named(name: string) {
      return this.findOne({name});
    },
  },
  plugins: [
    (pluginSchema) => {
      pluginSchema.post('validate', function () {
        const greeting: string = this.greet();
        // @ts-expect-error Inferred methods remain typed in plugin middleware.
        const invalid: number = this.greet();
        return {greeting, invalid};
      });
    },
  ],
});

export async function checkStrictModelTypes() {
  const Model = toStrictModel('StrictTypedUser', schema);
  Model.named('Ada');
  new Model({name: 'Ada'}).greet();
  Model.find().byName('Ada');
  Model.find().sort({name: 1}).byName('Ada');
  Model.find().where('name').equals('Ada').byName('Ada');
  Model.findOne().byName('Ada');
  Model.findById('id').byName('Ada');
  Model.findOneAndUpdate({}, {}).byName('Ada');
  Model.findByIdAndUpdate('id', {}).byName('Ada');
  const doc = await Model.findOne().exec();
  if (doc) {
    const greeting: string = doc.greet();
    const populated = await doc.populate('author');
    const authorName: string = populated.author.name;
    populated.greet();
    // @ts-expect-error Document methods keep their return types.
    const invalid: number = populated.greet();
    // @ts-expect-error Documents retain their known properties.
    doc.missing();
    // @ts-expect-error Strict population rejects unknown references.
    doc.populate('missing');
    return {greeting, authorName, invalid};
  }
  // @ts-expect-error Helper argument types are preserved.
  Model.find().byName(1);
  // @ts-expect-error Unknown helpers are rejected.
  Model.find().missing();
  // @ts-expect-error Static argument types are preserved.
  Model.named(1);
  // @ts-expect-error Unknown statics are rejected.
  Model.missing();
  return undefined;
}

export async function checkStrictHelperPopulation() {
  const Model = toStrictModel('StrictTypedPopulation', schema);
  const before = await Model.find().byName('Ada').populate('author').exec();
  const after = await Model.find().populate('author').byName('Ada').exec();
  const direct = await Model.findOne().populate('author').exec();
  if (!direct || !before[0] || !after[0]) return undefined;
  const first: string = before[0].author.name;
  const second: string = after[0].author.name;
  const third: string = direct.author.name;
  direct.greet();
  // @ts-expect-error Populated reference fields are typed, not any.
  before[0].author.missing();
  // @ts-expect-error Populated reference fields are typed after helper calls too.
  after[0].author.missing();
  // @ts-expect-error Populated documents preserve method return types.
  const invalid: number = direct.greet();
  return {first, second, third, invalid};
}

export async function checkExplicitAndLegacyTypes() {
  const Explicit = toStrictModel<User, typeof schema>('StrictExplicit', schema);
  Explicit.find().byName('Ada');
  (await Explicit.findOne().exec())?.greet();
  const Legacy = toStrictModel<User>('StrictLegacy', toMongooseSchema(user));
  const doc = await Legacy.findOne().populate('author').exec();
  if (!doc) return undefined;
  const {name}: {name: string} = doc.author;
  // @ts-expect-error Legacy calls still retain document field types.
  const invalid: number = doc.name;
  return {name, invalid};
}

const catalog = z.object({
  name: z.string(),
  author: zRef('TypedAuthor', author),
  items: z.array(z.object({label: z.string()})),
});
type Catalog = z.infer<typeof catalog>;
interface Methods {
  greet(): string;
}
interface Virtuals {
  displayName: string;
}
type CatalogDocument = mongoose.HydratedDocument<
  Catalog,
  Methods & Virtuals & {items: mongoose.Types.DocumentArray<{label: string}>}
>;
interface Helpers {
  byName(
    name: string,
  ): mongoose.QueryWithHelpers<CatalogDocument[], CatalogDocument, Helpers, Catalog>;
  countMatches(): mongoose.QueryWithHelpers<
    number,
    CatalogDocument,
    Helpers,
    Catalog,
    'countDocuments'
  >;
  echo(value: string): string;
  echo(value: number): number;
}
const echo: Helpers['echo'] = <Value extends string | number>(value: Value): Value => value;
const catalogOptions: ToMongooseSchemaOptions<
  Catalog,
  Methods,
  Helpers,
  {},
  Virtuals,
  CatalogDocument
> = {
  methods: {
    greet() {
      return this.name;
    },
  },
  virtuals: {
    displayName: {
      get() {
        return this.name;
      },
    },
  },
  query: {
    byName(
      this: mongoose.QueryWithHelpers<CatalogDocument[], CatalogDocument, Helpers, Catalog>,
      name,
    ) {
      return this.where({name});
    },
    countMatches(
      this: mongoose.QueryWithHelpers<CatalogDocument[], CatalogDocument, Helpers, Catalog>,
    ) {
      return this.countDocuments();
    },
    echo,
  },
  plugins: [
    (pluginSchema) => {
      // Plugin callbacks retain the schema's hydrated document, methods and virtuals.
      pluginSchema.post('validate', function () {
        this.items.id(new mongoose.Types.ObjectId());
        const name: string = this.greet();
        // @ts-expect-error Plugin middleware is typed, not any.
        const invalid: number = this.displayName;
        return {name, invalid};
      });
      // @ts-expect-error Plugin query helper signatures are preserved.
      pluginSchema.query.byName(1);
    },
  ],
};

export async function checkExplicitSchemaGenerics() {
  const catalogSchema = toMongooseSchema(catalog, catalogOptions);
  const NativeModel = mongoose.model('NativeCatalogTypes', catalogSchema);
  const Model = toStrictModel('StrictCatalogTypes', catalogSchema);
  new NativeModel().items.id(new mongoose.Types.ObjectId());
  new Model().items.id(new mongoose.Types.ObjectId());
  const created = await Model.create({name: 'Ada', items: []});
  created.greet();
  created.items.id(new mongoose.Types.ObjectId());
  Model.find().byName('Ada');
  const count: number = await Model.find().countMatches();
  const text: string = Model.find().echo('hello');
  const number: number = Model.find().echo(1);
  // @ts-expect-error Terminal helper overloads retain argument validation.
  Model.find().echo(false);
  // @ts-expect-error A helper that changes the result to a number keeps that result.
  const wrongCount: string = await Model.find().countMatches();
  const populated = await Model.findOne().populate('author').exec();
  if (!populated) return undefined;
  populated.items.id(new mongoose.Types.ObjectId());
  const display: string = populated.displayName;
  const greeting: string = populated.greet();
  const authorName: string = populated.author.name;
  // @ts-expect-error Explicit virtual value types are preserved.
  const invalidVirtual: number = populated.displayName;
  // @ts-expect-error Hydrated document overrides remain typed.
  populated.items.missing();
  return {count, text, number, wrongCount, display, greeting, authorName, invalidVirtual};
}
