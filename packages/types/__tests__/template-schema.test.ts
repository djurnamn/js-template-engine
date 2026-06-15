import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { createGenerator } from 'ts-json-schema-generator';
import { describe, expect, it } from 'vitest';

const packageDirectory = fileURLToPath(new URL('..', import.meta.url));

const committedSchema = JSON.parse(
  readFileSync(join(packageDirectory, 'schema', 'template.schema.json'), 'utf8')
);

const validateTemplate = new Ajv({ allErrors: true }).compile(committedSchema);

describe('template.schema.json', () => {
  it('matches a fresh generation from the types (no drift)', () => {
    const freshSchema = createGenerator({
      path: join(packageDirectory, 'src', 'index.ts'),
      tsconfig: join(packageDirectory, 'tsconfig.json'),
      type: 'Template',
      additionalProperties: false,
    }).createSchema('Template');
    expect(committedSchema).toEqual(JSON.parse(JSON.stringify(freshSchema)));
  });

  it('accepts a component-rooted template', () => {
    const template = {
      type: 'component',
      name: 'Button',
      props: { label: { type: 'string', required: true } },
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: { class: ['button'], disabled: false },
          events: [{ name: 'click', handler: 'handleClick' }],
          children: [{ type: 'text', expression: 'label' }],
        },
      ],
    };
    expect(validateTemplate(template)).toBe(true);
  });

  it('accepts a bare node array', () => {
    const template = [
      {
        type: 'element',
        tag: 'img',
        attributes: {
          alt: 'Avatar',
          width: 48,
          src: { $expression: 'props.avatarUrl' },
        },
      },
    ];
    expect(validateTemplate(template)).toBe(true);
  });

  it('rejects unknown node types', () => {
    expect(validateTemplate([{ type: 'banner' }])).toBe(false);
  });

  it('accepts the constrained $expression forms on class and style', () => {
    expect(
      validateTemplate([
        {
          type: 'element',
          tag: 'div',
          attributes: {
            class: ['card', { $expression: 'className' }],
            style: {
              color: 'blue',
              '--badge-size': { $expression: "size + 'rem'" },
            },
          },
        },
        {
          type: 'element',
          tag: 'div',
          attributes: {
            class: { $expression: 'className' },
            style: { $expression: 'computeStyleVariables(props)' },
          },
        },
      ])
    ).toBe(true);
  });

  it('rejects $expression values inside nested selector blocks', () => {
    expect(
      validateTemplate([
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              ':hover': { color: { $expression: 'props.hoverColor' } },
            },
          },
        },
      ])
    ).toBe(false);
  });

  it('rejects whole-object style expressions mixed with other keys', () => {
    expect(
      validateTemplate([
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: { color: 'blue', $expression: 'props.style' },
          },
        },
      ])
    ).toBe(false);
  });
});
