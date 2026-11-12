import { describe, expect, it } from 'vitest';

import { importedNames, partitionImports } from '../src/import-statements';

describe('partitionImports', () => {
  it('keeps one import statement per entry as an import', () => {
    expect(
      partitionImports([
        "import { ref } from 'vue';",
        "import type { Ref } from 'vue';",
        "import './side-effect.css';",
        "import * as helpers from './helpers'",
        "import Button, { type ButtonProps } from './Button.vue';",
      ])
    ).toEqual({
      importStatements: [
        "import { ref } from 'vue';",
        "import type { Ref } from 'vue';",
        "import './side-effect.css';",
        "import * as helpers from './helpers'",
        "import Button, { type ButtonProps } from './Button.vue';",
      ],
      declarations: [],
    });
  });

  it('separates the declarations written among the imports', () => {
    expect(
      partitionImports([
        "import { createContext } from 'react';",
        'let nextId = 0;',
        "export const ThemeContext = createContext('light');",
        "export type Tone = 'quiet' | 'loud';",
        'interface Item {\n  label: string;\n}',
        "export { helper } from './helper';",
      ])
    ).toEqual({
      importStatements: ["import { createContext } from 'react';"],
      declarations: [
        'let nextId = 0;',
        "export const ThemeContext = createContext('light');",
        "export type Tone = 'quiet' | 'loud';",
        'interface Item {\n  label: string;\n}',
        "export { helper } from './helper';",
      ],
    });
  });

  it('splits a multi-line entry where an import statement begins or ends', () => {
    expect(
      partitionImports([
        [
          "import {\n  createContext,\n  useContext,\n} from 'react';",
          'let nextId = 0; // shared by every instance',
          '/** The theme every instance reads. */',
          "const ThemeContext = createContext('light')",
          "import type { Tone } from './tone' with { type: 'json' };",
          'function nextIdentifier() {\n  return ++nextId;\n}',
        ].join('\n'),
      ])
    ).toEqual({
      importStatements: [
        "import {\n  createContext,\n  useContext,\n} from 'react';",
        "import type { Tone } from './tone' with { type: 'json' };",
      ],
      declarations: [
        "let nextId = 0; // shared by every instance\n/** The theme every instance reads. */\nconst ThemeContext = createContext('light')",
        'function nextIdentifier() {\n  return ++nextId;\n}',
      ],
    });
  });

  it('splits statements written on one line', () => {
    expect(
      partitionImports(["import { a } from './a'; const b = a; import './c';"])
    ).toEqual({
      importStatements: ["import { a } from './a';", "import './c';"],
      declarations: ['const b = a;'],
    });
  });

  it('reads `import` inside strings, templates, regular expressions and comments as text', () => {
    const entry = [
      'const label = "import x from \'y\'";',
      'const template = `${"`"} import y from \'z\' ${{ import: 1 }.import}`;',
      "const pattern = /import ' from/;",
      "// import z from 'z';",
      "const lazy = () => import('./lazy');",
      'const meta = import.meta.url;',
    ].join('\n');
    expect(partitionImports([entry])).toEqual({
      importStatements: [],
      declarations: [entry],
    });
  });

  it('keeps a comment on the line after the last import with it', () => {
    expect(
      partitionImports(["import { a } from './a';\n// a is shared"])
    ).toEqual({
      importStatements: ["import { a } from './a';\n// a is shared"],
      declarations: [],
    });
  });

  it('ends an import alias at its line break', () => {
    expect(
      partitionImports(['import Shape = Geometry.Shape\nconst unit = 1;'])
    ).toEqual({
      importStatements: ['import Shape = Geometry.Shape'],
      declarations: ['const unit = 1;'],
    });
  });

  it('reads a `/` after a postfix `++` or `--` as division', () => {
    expect(
      partitionImports([
        "const half = count++ / 2; import a from 'a';",
        "const less = count-- / 2; import b from 'b';",
      ])
    ).toEqual({
      importStatements: ["import a from 'a';", "import b from 'b';"],
      declarations: ['const half = count++ / 2;', 'const less = count-- / 2;'],
    });
  });

  it('reads `import` after a member access as a property, across a line break', () => {
    const entry = "const flag = options.\nimport ? 'x' : 'y';";
    expect(partitionImports([entry])).toEqual({
      importStatements: [],
      declarations: [entry],
    });
  });
});

describe('importedNames', () => {
  it('reads default, namespace and named imports, under their local names', () => {
    expect(
      importedNames([
        "import { useState, useId as id } from 'react';",
        "import type { Ref } from 'vue';",
        "import { type ComputedRef, computed } from 'vue';",
        "import Toggle, * as parts from './Toggle';",
        "import './side-effect.css';",
      ])
    ).toEqual(new Set(['useState', 'id', 'Ref', 'ComputedRef', 'computed', 'Toggle', 'parts']));
  });
});
