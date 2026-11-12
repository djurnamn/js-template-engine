import { process } from '@js-template-engine/core';
import type { Template, TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { vue } from '../src/index';

const space: TemplateNode = { type: 'text', content: ' ' };
const lineBreak: TemplateNode = { type: 'text', content: '\n' };
const nbsp: TemplateNode = { type: 'text', content: '\u00a0' };
const label: TemplateNode = { type: 'text', content: 'label' };
const name: TemplateNode = { type: 'text', expression: 'name' };
const note: TemplateNode = { type: 'comment', content: 'note' };
const bold: TemplateNode = {
  type: 'element',
  tag: 'b',
  children: [{ type: 'text', content: 'x' }],
};

/** The Vue template of a span, or of the root, holding these nodes. */
function rendered(nodes: TemplateNode[], root = false): string {
  const children = root
    ? nodes
    : [{ type: 'element', tag: 'span', children: nodes } as TemplateNode];
  const template = {
    type: 'component',
    name: 'Probe',
    props: { name: { type: 'string', required: true } },
    children,
  } as Template;
  const [file] = process(template, { extensions: [vue()] }).files;
  return /<template>\n([\s\S]*)\n<\/template>/.exec(file.content)![1];
}

// Each row is one way Vue's parser treats whitespace-only text, in development
// (comments kept) or in a production build (comments stripped first).
describe('whitespace-only text Vue would remove', () => {
  it.each<[string, TemplateNode[]]>([
    ['at the start of the content', [space, name]],
    ['at the end of the content', [name, space]],
    [
      'before a trailing comment, removed once comments are stripped',
      [name, space, note],
    ],
    ['after two comments, at the end', [note, note, space]],
    ['between a comment and an element', [name, note, space, bold]],
    ['holding a line break between two elements', [bold, lineBreak, bold]],
  ])('is written as an expression %s', (_shape, nodes) => {
    expect(rendered(nodes)).toMatch(/\{\{ '(?: |\\n)' \}\}/);
  });

  it('is written as an expression at the edge of the root content', () => {
    expect(rendered([space, name], true)).toContain("{{ ' ' }}");
    expect(rendered([bold, space], true)).toContain("{{ ' ' }}");
  });

  it.each<[string, TemplateNode[], string]>([
    [
      'between two interpolations',
      [name, space, name],
      '{{ name }} {{ name }}',
    ],
    ['a space between two elements', [bold, space, bold], '</b> <b>'],
    [
      'after an element, a comment and before an interpolation',
      [bold, note, space, name],
      ' {{ name }}',
    ],
    [
      'joined to text across a comment',
      [label, note, space, name],
      ' {{ name }}',
    ],
    ['joined to text beside it', [space, label, name], ' label{{ name }}'],
  ])('stays as authored %s', (_shape, nodes, expected) => {
    const output = rendered(nodes);
    expect(output).toContain(expected);
    expect(output).not.toContain("{{ ' ' }}");
  });

  it('leaves a non-breaking space to the parser, which keeps it', () => {
    expect(rendered([nbsp, name])).not.toContain("{{ '");
  });
});
