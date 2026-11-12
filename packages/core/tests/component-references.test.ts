import type { ProcessResult, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import type { TargetExtension } from '../src/extension';
import { process } from '../src/process';

const target = (
  key: string,
  builtInComponents?: readonly string[]
): TargetExtension => ({
  key,
  kind: 'target',
  builtInComponents,
  render: (): ProcessResult => ({ files: [], warnings: [] }),
});

const referenceWarnings = (
  template: Template,
  extension: TargetExtension = target('react')
) =>
  process(template, { extensions: [extension] }).warnings.filter((warning) =>
    warning.message.includes('is not in scope')
  );

const composed = (
  overrides: Record<string, unknown> = {},
  child: Record<string, unknown> = {}
): Template =>
  ({
    type: 'component',
    name: 'Card',
    children: [
      {
        type: 'element',
        tag: 'div',
        children: [{ type: 'element', tag: 'UserAvatar', ...child }],
      },
    ],
    ...overrides,
  }) as Template;

describe('component reference warnings', () => {
  it('warns about a capitalized tag nothing brings into scope, naming the target', () => {
    expect(referenceWarnings(composed())).toEqual([
      {
        message:
          '<UserAvatar> is not in scope in the react output: no import, prop or binding of the component names it, ' +
          'so the generated file will not compile. Import it in imports, or in extensions.react.imports where the ' +
          'module path differs per target.',
        nodePath: 'children[0].children[0]',
      },
    ]);
  });

  it('accepts a name an import, the target imports, the script or a prop brings in', () => {
    expect(
      referenceWarnings(
        composed({ imports: ["import { UserAvatar } from './UserAvatar';"] })
      )
    ).toEqual([]);
    expect(
      referenceWarnings(
        composed({
          extensions: {
            vue: { imports: ["import UserAvatar from './UserAvatar.vue';"] },
          },
        }),
        target('vue')
      )
    ).toEqual([]);
    expect(
      referenceWarnings(composed({ script: 'const UserAvatar = Avatar;' }))
    ).toEqual([]);
    expect(
      referenceWarnings(
        composed({ props: { UserAvatar: { type: 'ComponentType' } } })
      )
    ).toEqual([]);
  });

  it("reads one target's imports override, not another's", () => {
    const template = composed({
      extensions: {
        vue: { imports: ["import UserAvatar from './UserAvatar.vue';"] },
      },
    });
    expect(referenceWarnings(template, target('react'))).toHaveLength(1);
  });

  it('ignores a type-only import and the module path', () => {
    expect(
      referenceWarnings(
        composed({
          imports: [
            "import type { UserAvatar } from './UserAvatar';",
            "import { type UserAvatarProps, Avatar } from './UserAvatar';",
          ],
        })
      )
    ).toHaveLength(1);
  });

  it('reads the first segment of a member tag and accepts a binding in scope', () => {
    expect(
      referenceWarnings(composed({}, { tag: 'Select.Root' })).map((warning) =>
        warning.message.slice(0, 9)
      )
    ).toEqual(['<Select> ']);
    expect(
      referenceWarnings({
        type: 'component',
        name: 'List',
        props: { items: { type: 'Item[]' } },
        children: [
          {
            type: 'iteration',
            items: 'items',
            item: 'Entry',
            children: [{ type: 'element', tag: 'Entry.Icon' }],
          },
        ],
      })
    ).toEqual([]);
  });

  it("follows a fragment's wrapper tag, which renders only where the target names one", () => {
    const portal: Template = {
      type: 'component',
      name: 'Overlay',
      children: [
        {
          type: 'fragment',
          extensions: {
            react: { tag: 'Portal' },
            vue: { tag: 'Teleport', attributes: { to: 'body' } },
          },
          children: [{ type: 'element', tag: 'Sheet' }],
        },
      ],
    };
    expect(
      referenceWarnings(portal, target('react')).map(
        (warning) => warning.nodePath
      )
    ).toEqual(['children[0]', 'children[0].children[0]']);
    expect(
      referenceWarnings(portal, target('vue', ['Teleport'])).map(
        (warning) => warning.nodePath
      )
    ).toEqual(['children[0].children[0]']);
    expect(
      referenceWarnings(portal, target('svelte')).map(
        (warning) => warning.nodePath
      )
    ).toEqual(['children[0].children[0]']);
  });

  it('leaves lower-case tags, the component itself and HTML mode alone', () => {
    const template: Template = {
      type: 'component',
      name: 'Tree',
      children: [
        {
          type: 'element',
          tag: 'svg',
          children: [
            { type: 'element', tag: 'linearGradient' },
            { type: 'element', tag: 'foreignObject' },
            { type: 'element', tag: 'Tree' },
          ],
        },
      ],
    };
    expect(referenceWarnings(template)).toEqual([]);
    expect(process(composed()).warnings).toEqual([]);
  });

  it('says a target that registers components globally may still resolve it', () => {
    const extension: TargetExtension = {
      ...target('vue'),
      globalComponentRegistration: true,
    };
    expect(referenceWarnings(composed(), extension)[0].message).toContain(
      'so the generated file will not compile unless the component is registered globally. Import it'
    );
    expect(referenceWarnings(composed())[0].message).toContain(
      'will not compile. Import it'
    );
  });

  it('warns once per name, at its first element', () => {
    const template: Template = {
      type: 'component',
      name: 'Pair',
      children: [
        { type: 'element', tag: 'Avatar' },
        { type: 'element', tag: 'Avatar' },
      ],
    };
    expect(referenceWarnings(template)).toHaveLength(1);
  });
});

describe('a tag override on a fragment', () => {
  const fragment = (override: Record<string, unknown>) =>
    ({
      type: 'component',
      name: 'Group',
      children: [
        {
          type: 'fragment',
          extensions: { react: override },
          children: [{ type: 'element', tag: 'span' }],
        },
      ],
    }) as unknown as Template;

  it('names the wrapper a target renders, a lower-case tag being an element', () => {
    expect(
      referenceWarnings(fragment({ tag: 'section' }), target('react'))
    ).toEqual([]);
  });

  it('needs a tag for its attributes and events to mean anything', () => {
    expect(() =>
      process(fragment({ attributes: { role: 'group' } }), {
        extensions: [target('react')],
      })
    ).toThrow(/A fragment's react block renders a wrapper only with a 'tag'/);
  });
});
