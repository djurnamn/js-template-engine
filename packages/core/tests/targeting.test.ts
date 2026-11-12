import type { TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { generatedNodeValue, planTargets } from '../src/html/targeting';

describe('generatedNodeValue', () => {
  it('joins the component name and the counter', () => {
    expect(generatedNodeValue('StatGrid', 0)).toBe('StatGrid-0');
    expect(generatedNodeValue('StatGrid', 12)).toBe('StatGrid-12');
  });

  it('keeps the value safe as an attribute value and in a selector', () => {
    expect(generatedNodeValue('My "Card"', 1)).toBe('My_20__22_Card_22_-1');
    expect(generatedNodeValue('Card.Header', 0)).toBe('Card_2e_Header-0');
    expect(generatedNodeValue('Card Header', 0)).not.toBe(
      generatedNodeValue('Card.Header', 0)
    );
    expect(generatedNodeValue('Kort\u{1F600}', 0)).toBe('Kort_1f600_-0');
    expect(generatedNodeValue('', 0)).toBe('Component-0');
  });
});

describe('planTargets', () => {
  it('counts a component’s class-less elements under its name', () => {
    const children: TemplateNode[] = [
      { type: 'element', tag: 'div', attributes: { style: { color: 'red' } } },
      {
        type: 'element',
        tag: 'p',
        attributes: { class: 'note', style: { color: 'blue' } },
      },
      { type: 'element', tag: 'em', attributes: { style: { color: 'gray' } } },
    ];
    const targets = [
      ...planTargets(
        children,
        'in-file',
        undefined,
        undefined,
        'Note'
      ).values(),
    ];
    expect(targets).toEqual([
      {
        selector: '[data-jte-node="Note-0"]',
        generatedNodeIndex: 0,
        generatedNodeValue: 'Note-0',
      },
      { selector: '.note' },
      {
        selector: '[data-jte-node="Note-1"]',
        generatedNodeIndex: 1,
        generatedNodeValue: 'Note-1',
      },
    ]);
  });
});
