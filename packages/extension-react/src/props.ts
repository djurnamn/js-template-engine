import { TemplateError } from '@js-template-engine/core';
import type { PropDefinition, TemplateNode } from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';

/** A prop synthesized from a slot. */
export interface SlotProp {
  /** The authored slot name; `undefined` for the default slot. */
  slotName: string | undefined;
  /** The normalized React prop name; `'children'` for the default slot. */
  propName: string;
}

/**
 * Normalizes a slot name to a valid JavaScript identifier: kebab-case and
 * snake_case convert to camelCase (`navigation-menu` → `navigationMenu`),
 * and a leading digit is prefixed with an underscore (`123invalid` →
 * `_123invalid`).
 */
export function normalizeSlotName(name: string): string {
  const segments = name.split(/[^A-Za-z0-9$]+/).filter((segment) => segment !== '');
  const camelCased = segments
    .map((segment, index) =>
      index === 0
        ? segment
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`
    )
    .join('');
  return /^\d/.test(camelCased) ? `_${camelCased}` : camelCased;
}

/**
 * Collects the props synthesized from a component's slots, in document
 * order, deduplicated by slot name.
 *
 * Two slots whose names normalize to the same prop name, or a slot whose
 * prop name collides with a declared prop, are processing errors.
 */
export function collectSlotProps(
  children: TemplateNode[],
  declaredProps: Record<string, PropDefinition>
): SlotProp[] {
  const slotProps: SlotProp[] = [];
  const byPropName = new Map<string, SlotProp>();

  const visit = (nodes: TemplateNode[], path: string): void => {
    nodes.forEach((node, index) => {
      const nodePath = path === '' ? `[${index}]` : `${path}[${index}]`;
      switch (node.type) {
        case 'element':
          if (node.children) {
            visit(node.children, `${nodePath}.children`);
          }
          break;
        case 'fragment':
          visit(node.children, `${nodePath}.children`);
          break;
        case 'conditional':
          node.conditions.forEach((branch, branchIndex) => {
            visit(
              branch.children,
              `${nodePath}.conditions[${branchIndex}].children`
            );
          });
          break;
        case 'iteration':
          visit(node.children, `${nodePath}.children`);
          break;
        case 'slot': {
          registerSlot(node.name, nodePath);
          if (node.fallback) {
            visit(node.fallback, `${nodePath}.fallback`);
          }
          break;
        }
        default:
          break;
      }
    });
  };

  const registerSlot = (
    slotName: string | undefined,
    nodePath: string
  ): void => {
    const propName = slotName === undefined ? 'children' : normalizeSlotName(slotName);
    const existing = byPropName.get(propName);
    if (existing !== undefined) {
      if (existing.slotName !== slotName) {
        throw new TemplateError(
          `Slots '${existing.slotName ?? '(default)'}' and '${slotName ?? '(default)'}' both normalize to the React prop '${propName}'`,
          nodePath
        );
      }
      return;
    }
    if (propName in declaredProps) {
      throw new TemplateError(
        `The slot '${slotName ?? '(default)'}' collides with the declared prop '${propName}'`,
        nodePath
      );
    }
    const slotProp: SlotProp = { slotName, propName };
    byPropName.set(propName, slotProp);
    slotProps.push(slotProp);
  };

  visit(children, '');
  return slotProps;
}

/**
 * Renders the generated props interface: declared props in authored order,
 * then slot-synthesized `ReactNode` entries in document order. Returns
 * `undefined` when there is nothing to declare.
 *
 * For a passthrough surface root (`passthroughTag` set), the props extend
 * `ComponentPropsWithRef<'<tag>'>` — admitting the consumer's arbitrary
 * attributes plus the ref-as-prop, `className`, and `style` — and the block
 * is always emitted even with no declared or slot entries (a bare type alias
 * then).
 */
export function propsInterface(
  componentName: string,
  declaredProps: Record<string, PropDefinition>,
  slotProps: SlotProp[],
  passthroughTag?: string
): string | undefined {
  const entries: string[] = [];
  for (const [name, definition] of Object.entries(declaredProps)) {
    const optionalMarker = definition.required === true ? '' : '?';
    entries.push(`  ${name}${optionalMarker}: ${definition.type};`);
  }
  for (const slotProp of slotProps) {
    entries.push(`  ${slotProp.propName}?: ReactNode;`);
  }
  if (passthroughTag !== undefined) {
    const base = `ComponentPropsWithRef<'${passthroughTag}'>`;
    if (entries.length === 0) {
      return `type ${componentName}Props = ${base};`;
    }
    return `interface ${componentName}Props extends ${base} {\n${entries.join('\n')}\n}`;
  }
  if (entries.length === 0) {
    return undefined;
  }
  return `interface ${componentName}Props {\n${entries.join('\n')}\n}`;
}

/**
 * Renders the prop destructuring statement with defaults:
 * `const { label, variant = 'primary' } = props;`. Returns `undefined`
 * when no props are declared.
 *
 * For a passthrough surface root, the consumer `className`, `style`, and
 * `ref` are destructured out (handled explicitly by the renderer) and the
 * remaining undeclared props are gathered into `...rest` for the spread —
 * so the statement is emitted even with no declared props
 * (`const { className, style, ref, ...rest } = props;`). Slot prop names are
 * destructured too so the framework's slot props never leak into the
 * spread as invalid DOM attributes.
 */
export function propsDestructuring(
  declaredProps: Record<string, PropDefinition>,
  passthrough = false,
  slotPropNames: readonly string[] = []
): string | undefined {
  const names = Object.entries(declaredProps).map(([name, definition]) =>
    definition.default === undefined
      ? name
      : `${name} = ${serializeJavaScriptValue(definition.default)}`
  );
  if (passthrough) {
    names.push(...slotPropNames, 'className', 'style', 'ref', '...rest');
  }
  if (names.length === 0) {
    return undefined;
  }
  return `const { ${names.join(', ')} } = props;`;
}
