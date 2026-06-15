/**
 * Generates the JSON Schema for the `Template` type into
 * `schema/template.schema.json`.
 *
 * The schema is the JSON-transport counterpart of the TypeScript types and
 * is regenerated on every build; a unit test guards against drift between the
 * committed file and the types.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');

const schema = createGenerator({
  path: join(packageDirectory, 'src', 'index.ts'),
  tsconfig: join(packageDirectory, 'tsconfig.json'),
  type: 'Template',
  additionalProperties: false,
}).createSchema('Template');

const outputDirectory = join(packageDirectory, 'schema');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  join(outputDirectory, 'template.schema.json'),
  `${JSON.stringify(schema, null, 2)}\n`
);
