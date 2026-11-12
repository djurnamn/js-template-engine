import type {
  AttributeOverrides,
  ElementNode,
  NestedStyleObject,
  Warning,
} from '@js-template-engine/types';

import { mergeAttributeOverride } from './attribute-overrides';
import { nodeSpreads, wholeStyleExpression } from './expression-binding';
import type { TargetExtension } from './extension';
import {
  hasExpressionProperties,
  hasNestedSelectors,
  hasPlainProperties,
} from './html/targeting';
import type { NormalizedComponent } from './normalize';
import { visitElements } from './traverse';

/** Whether an attribute value is present: not absent, empty or `[]`. */
function hasValue(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    !(Array.isArray(value) && value.length === 0) &&
    value !== ''
  );
}

/** Whether an element carries a class of its own, authored or contributed
 *  by a styling extension. */
function hasOwnClass(element: ElementNode): boolean {
  return (
    hasValue(element.attributes?.class) ||
    (element.conditionalAttributes ?? []).some((entry) =>
      hasValue(entry.attributes.class)
    )
  );
}

/**
 * Whether a style the target renders replaces the consumer's style a spread
 * of `rest` carries: a whole-object expression, a static style the `inline`
 * placement keeps inline, or, where expression-valued properties are not
 * directives, one of those. A static style bound for the stylesheet leaves
 * nothing inline, and neither does a conditional entry's, so neither
 * replaces anything.
 */
function replacesConsumerStyle(
  style: unknown,
  placement: string,
  styleDirectives: boolean
): boolean {
  if (typeof style !== 'object' || style === null || Array.isArray(style)) {
    return hasValue(style);
  }
  const object = style as NestedStyleObject;
  if (wholeStyleExpression(object) !== undefined) {
    return true;
  }
  if (
    placement === 'inline' &&
    !hasNestedSelectors(object) &&
    hasPlainProperties(object)
  ) {
    return true;
  }
  return !styleDirectives && hasExpressionProperties(object);
}

/**
 * Whether an attribute value reads `rest.<key>` in one of its expressions (a
 * class list's entries, a style's `$expression` and properties): a member
 * access, which an object spread (`{ ...rest.style }`) also counts as, but
 * not a property of some other value (`props.rest.style`). A target keeping
 * the consumer's style last on a node whose style reads it calls this too.
 *
 * @param value - The attribute value: a string, an expression binding, a
 *   class list or a style object.
 * @param key - The key of `rest` read: `'style'`, `'className'`, `'class'`.
 * @returns `true` when an expression in the value reads `rest.<key>`.
 *
 * @example
 * readsRest({ $expression: '[{ gap }, rest.style]' }, 'style'); // true
 * readsRest({ $expression: 'props.rest.style' }, 'style'); // false
 */
export function readsRest(value: unknown, key: string): boolean {
  const reference = new RegExp(
    `(?:(?<![\\w$.])|(?<=\\.\\.\\.\\s*))rest\\s*(?:\\??\\.\\s*${key}\\b|(?:\\?\\.)?\\[\\s*['"]${key}['"]\\s*\\])`
  );
  const visit = (entry: unknown): boolean => {
    if (Array.isArray(entry)) {
      return entry.some(visit);
    }
    if (typeof entry === 'object' && entry !== null) {
      return Object.values(entry).some(visit);
    }
    return typeof entry === 'string' && reference.test(entry);
  };
  return visit(value);
}

/**
 * Whether a class value hands the whole `rest` record to a helper that keeps
 * the consumer's class: `consumerClass(rest)` or `mergeRootProps(own, rest)`.
 */
function mergesRestClass(value: unknown): boolean {
  const call =
    /(?<![\w$.])(?:consumerClass\s*\(\s*rest\s*\)|mergeRootProps\s*\((?:.*,)?\s*rest\s*[,)])/;
  const visit = (entry: unknown): boolean => {
    if (Array.isArray(entry)) {
      return entry.some(visit);
    }
    if (typeof entry === 'object' && entry !== null) {
      return Object.values(entry).some(visit);
    }
    return typeof entry === 'string' && call.test(entry);
  };
  return visit(value);
}

/**
 * The members of an object literal expression with its top-level spreads of
 * `rest.<key>` taken out, for a target that spreads the consumer's value
 * after the node's own properties itself and so reads it once, last.
 *
 * @param expression - The whole-object expression, as authored.
 * @param key - The key of `rest` spread: `'style'`.
 * @returns The literal's remaining members, as written, or `undefined` when
 *   the expression is no object literal or spreads no `rest.<key>` at its
 *   top level.
 *
 * @example
 * literalMembersWithoutRest('{ ...styles, ...rest.style }', 'style'); // ['...styles']
 * literalMembersWithoutRest('merge(styles, rest.style)', 'style'); // undefined
 */
export function literalMembersWithoutRest(
  expression: string,
  key: string
): string[] | undefined {
  const text = expression.trim();
  if (!text.startsWith('{') || !text.endsWith('}')) {
    return undefined;
  }
  const depths = bracketDepths(text);
  const closing = depths.findIndex(
    (depth, index) => index > 0 && depth === 0 && text[index] === '}'
  );
  if (closing !== text.length - 1) {
    return undefined;
  }
  const members: string[] = [];
  let start = 1;
  for (let i = 1; i < closing; i += 1) {
    if (text[i] === ',' && depths[i] === 1) {
      members.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  members.push(text.slice(start, closing).trim());
  const spread = new RegExp(
    `^\\.\\.\\.\\s*rest\\s*(?:\\??\\.\\s*${key}|(?:\\?\\.)?\\[\\s*['"]${key}['"]\\s*\\])$`
  );
  const nonEmpty = members.filter((member) => member !== '');
  const kept = nonEmpty.filter((member) => !spread.test(member));
  return kept.length === nonEmpty.length ? undefined : kept;
}

/** The characters after which a `/` starts a regular expression literal
 *  rather than a division. */
const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));

/** The keywords after which a `/` starts a regular expression literal. */
const REGEX_PRECEDING_KEYWORDS =
  /(?:^|[^\w$])(?:return|typeof|void|delete|in|of|case|do|else|new|throw|yield|await)\s*$/;

/**
 * The bracket depth of each character of an expression, or -1 inside a
 * string, template or regular expression literal or a comment. An opening
 * bracket and its closing bracket carry the depth around them, the
 * characters between one more.
 */
function bracketDepths(text: string): number[] {
  const depths: number[] = new Array<number>(text.length).fill(-1);
  let depth = 0;
  let index = 0;
  const skipTo = (end: number): void => {
    index = Math.min(end, text.length);
  };
  while (index < text.length) {
    const character = text[index];
    if (character === "'" || character === '"' || character === '`') {
      let cursor = index + 1;
      while (cursor < text.length && text[cursor] !== character) {
        cursor += text[cursor] === '\\' ? 2 : 1;
      }
      skipTo(cursor + 1);
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index);
      skipTo(end === -1 ? text.length : end);
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      skipTo(end === -1 ? text.length : end + 2);
      continue;
    }
    if (character === '/') {
      const before = text.slice(0, index).trimEnd();
      const previous = before[before.length - 1];
      if (
        previous === undefined ||
        REGEX_PRECEDERS.has(previous) ||
        REGEX_PRECEDING_KEYWORDS.test(before)
      ) {
        let cursor = index + 1;
        let inClass = false;
        while (cursor < text.length) {
          const inner = text[cursor];
          if (inner === '\\') {
            cursor += 2;
            continue;
          }
          if (inner === '[') {
            inClass = true;
          } else if (inner === ']') {
            inClass = false;
          } else if (inner === '/' && !inClass) {
            break;
          }
          cursor += 1;
        }
        cursor += 1;
        while (cursor < text.length && /[a-z]/i.test(text[cursor])) {
          cursor += 1;
        }
        skipTo(cursor);
        continue;
      }
    }
    if ('([{'.includes(character)) {
      depths[index] = depth;
      depth += 1;
    } else if (')]}'.includes(character)) {
      depth = Math.max(0, depth - 1);
      depths[index] = depth;
    } else {
      depths[index] = depth;
    }
    index += 1;
  }
  return depths;
}

/** The index of the first match of `pattern` at depth zero, outside literals. */
function topLevelIndex(text: string, pattern: RegExp): number {
  const depths = bracketDepths(text);
  const global = new RegExp(pattern.source, 'g');
  for (
    let match = global.exec(text);
    match !== null;
    match = global.exec(text)
  ) {
    if (depths[match.index] === 0) {
      return match.index;
    }
  }
  return -1;
}

/**
 * The values an operand can hand on, with TypeScript's `as` and
 * `satisfies` and wrapping parentheses taken off: both arms of a
 * conditional, and the left operand of a `??` or `||` fallback.
 */
function operandValues(operand: string): string[] {
  let text = operand.trim();
  for (;;) {
    const cast = topLevelIndex(text, /\b(?:as|satisfies)\b/);
    if (cast > 0) {
      text = text.slice(0, cast).trim();
      continue;
    }
    if (text.startsWith('(')) {
      const depths = bracketDepths(text);
      const close = depths.findIndex(
        (depth, index) => index > 0 && depth === 0 && text[index] === ')'
      );
      if (close === text.length - 1) {
        text = text.slice(1, -1).trim();
        continue;
      }
    }
    break;
  }
  const question = topLevelIndex(text, /\?(?![?.])/);
  if (question > 0 && text[question - 1] !== '?') {
    const rest = text.slice(question + 1);
    const colon = topLevelIndex(rest, /:/);
    if (colon >= 0) {
      return [
        ...operandValues(rest.slice(0, colon)),
        ...operandValues(rest.slice(colon + 1)),
      ];
    }
  }
  const fallback = topLevelIndex(text, /\?\?|\|\|/);
  if (fallback > 0) {
    return operandValues(text.slice(0, fallback));
  }
  return [text];
}

/** The operand following an index, up to the comma or closing bracket that
 *  ends it at the same depth. */
function operandAt(text: string, from: number, depths: number[]): string {
  const depth = depths[from - 1] ?? 0;
  let index = from;
  while (index < text.length) {
    const character = text[index];
    if (
      depths[index] !== -1 &&
      ((depths[index] === depth && character === ',') ||
        (depths[index] < depth && ')]}'.includes(character)))
    ) {
      break;
    }
    index += 1;
  }
  return text.slice(from, index);
}

/** The operands an expression treats as an object: each spread's (`...x`)
 *  and each `Object.assign(...)` argument. */
function objectOperands(text: string): string[] {
  const depths = bracketDepths(text);
  const operands: string[] = [];
  for (
    let index = text.indexOf('...');
    index !== -1;
    index = text.indexOf('...', index + 3)
  ) {
    if (depths[index] !== -1) {
      operands.push(operandAt(text, index + 3, depths));
    }
  }
  const call = /\bObject\s*\.\s*assign\s*\(/g;
  for (let match = call.exec(text); match !== null; match = call.exec(text)) {
    const open = match.index + match[0].length - 1;
    if (depths[open] === -1) {
      continue;
    }
    let start = open + 1;
    for (let index = start; index < text.length; index++) {
      if (depths[index] === -1) {
        continue;
      }
      if (depths[index] === depths[open] && text[index] === ')') {
        operands.push(text.slice(start, index));
        break;
      }
      if (depths[index] === depths[open] + 1 && text[index] === ',') {
        operands.push(text.slice(start, index));
        start = index + 1;
      }
    }
  }
  return operands;
}

/** Whether a style override treats `rest.style` as an object: spreads it
 *  (`{ ...rest.style }`, `{ ...rest['style'] }`) or passes it to
 *  `Object.assign` as an argument of its own. A cast (`as`, `satisfies`),
 *  parentheses, either arm of a conditional and the left of a `??` or `||`
 *  fallback count as the argument itself. An expression that hands it on
 *  otherwise - an array entry (`[{ gap }, rest.style]`), a parser
 *  (`parse(String(rest.style))`) - treats it as the string it is. */
function spreadsRestStyle(value: unknown): boolean {
  const reference =
    /^rest\s*(?:\??\.\s*style|(?:\?\.)?\[\s*['"]style['"]\s*\])$/;
  const test = (text: string): boolean =>
    objectOperands(text).some((operand) =>
      operandValues(operand).some((entry) => reference.test(entry))
    );
  const visit = (entry: unknown): boolean => {
    if (Array.isArray(entry)) {
      return entry.some(visit);
    }
    if (typeof entry === 'object' && entry !== null) {
      return Object.values(entry).some(visit);
    }
    return typeof entry === 'string' && test(entry);
  };
  return visit(value);
}

/**
 * Warns where a component declaring `rest` spreads exactly `rest` onto a node
 * that also renders its own class or inline style: the authored value follows
 * the spread and replaces the consumer's class or style the spread carried. A
 * target that merges them (Vue) is never warned for, and neither is a node
 * whose override for the target sets the class from an expression reading
 * the consumer's (`rest.className` in React, `rest.class` in Svelte), or the
 * style from one reading `rest.style`. A style counts only where it renders
 * inline: a static style bound for the stylesheet replaces nothing, and in a
 * target writing expression-valued properties as directives (Svelte) only
 * a whole-object expression or a static inline style does. Where `rest.style`
 * is a string (Svelte), a style override spreading it or passing it to
 * `Object.assign` as an argument gets a warning of its own instead. A node's
 * warnings come together, the class's beside the style's. A spread
 * expression that passes `rest` to a helper is the author's to merge and is
 * not inspected - expressions stay opaque, so only the exact identifier is
 * matched.
 *
 * @param component - The component after styling extensions have run.
 * @param target - The target rendered, which says how it keeps the
 *   consumer's class and style.
 * @param placement - The stylesheet placement, which says whether a
 *   static style renders inline (`'inline'`) or in the stylesheet. Defaults to
 *   `'in-file'`.
 * @returns The warnings, each node's together, in document order.
 */
export function collectRestSpreadWarnings(
  component: NormalizedComponent,
  target?: Pick<TargetExtension, 'key' | 'restClassAndStyle'>,
  placement = 'in-file'
): Warning[] {
  const keeping = target?.restClassAndStyle;
  if (component.rest === undefined) {
    return [];
  }
  // The attributes an element renders in the target, its override merged.
  const targetAttributes = (element: ElementNode) =>
    target === undefined
      ? element.attributes
      : mergeAttributeOverride(
          element.attributes,
          (
            element.extensions?.[target.key] as
              | { attributes?: AttributeOverrides }
              | undefined
          )?.attributes
        );
  const warnings: Warning[] = [];
  // An override that removes the rest spread, with no element of the target
  // spreading it, leaves the consumer's attributes nowhere.
  if (target !== undefined) {
    let spreadsInTarget = false;
    const removedOn: string[] = [];
    visitElements(component.children, (element) => {
      const own = nodeSpreads(element.attributes).includes('rest');
      const inTarget = nodeSpreads(targetAttributes(element)).includes('rest');
      spreadsInTarget ||= inTarget;
      if (own && !inTarget) {
        removedOn.push(
          typeof element.tag === 'string' ? element.tag : element.tag.default
        );
      }
    });
    if (!spreadsInTarget) {
      for (const tag of removedOn) {
        warnings.push({
          message:
            `<${tag}>'s ${target.key} override removes its rest spread, and no other element spreads rest, ` +
            `so the consumer's attributes carried in rest are not forwarded in ${target.key}.`,
        });
      }
    }
  }
  if (keeping === 'merged') {
    return warnings;
  }
  visitElements(component.children, (element) => {
    if (!nodeSpreads(targetAttributes(element)).includes('rest')) {
      return;
    }
    const override =
      target === undefined
        ? undefined
        : (
            element.extensions?.[target.key] as
              | { attributes?: Record<string, unknown> }
              | undefined
          )?.attributes;
    const tag =
      typeof element.tag === 'string' ? element.tag : element.tag.default;
    // Where `rest.style` is a string, a style override spreading it is a
    // warning of its own; the class is still checked.
    const brokenStyle =
      keeping !== undefined &&
      keeping.styleString === true &&
      spreadsRestStyle(override?.style);
    if (brokenStyle) {
      warnings.push({
        message:
          `<${tag}>'s style override reads rest.style as an object, but in this target it is ` +
          `the consumer's style string, so a spread or Object.assign breaks it into characters. ` +
          `List it after the node's own style instead: [{ ... }, rest.style].`,
      });
    }
    // The style the target renders: its override's, which replaces the
    // node's, or the node's own.
    const style =
      override !== undefined && 'style' in override
        ? override.style
        : element.attributes?.style;
    // The class the target renders: its override's (React may spell it
    // `className`), which replaces the node's, or the node's own.
    // A `null` class removes the node's, so the target renders none.
    // `className` is the class only where the target spells it so (React).
    const classNameKey =
      keeping?.classKey === 'className' ? override?.className : undefined;
    const overrideClass =
      override?.class !== undefined ? override.class : classNameKey;
    const own: Array<'class' | 'style'> = [];
    if (
      overrideClass !== undefined
        ? hasValue(overrideClass) ||
          (element.conditionalAttributes ?? []).some((entry) =>
            hasValue(entry.attributes.class)
          )
        : hasOwnClass(element)
    ) {
      own.push('class');
    }
    if (
      !brokenStyle &&
      replacesConsumerStyle(style, placement, keeping?.styleDirectives === true)
    ) {
      own.push('style');
    }
    const lost = own.filter((name) => {
      if (keeping === undefined || override === undefined) {
        return true;
      }
      if (name === 'class' && mergesRestClass(overrideClass)) {
        return false;
      }
      const key = name === 'class' ? keeping.classKey : 'style';
      return !readsRest(name === 'class' ? overrideClass : override.style, key);
    });
    for (const name of lost) {
      warnings.push({
        message:
          `<${tag}> spreads rest and also carries its own ${name}, which replaces the consumer's ` +
          `${name} carried in rest. Spread rest onto a passthrough component, which merges it, ` +
          `merge the ${name} in a helper, or set the node's ${name} in this target's override ` +
          `from an expression that reads the consumer's (${
            name === 'class'
              ? 'consumerClass(rest) from @scaffold-ui-kit/helpers/runtime, or rest.className in React, rest.class in Svelte'
              : 'rest.style, a string in Svelte, where an array merges it last: [ownStyle, rest.style]'
          }).`,
      });
    }
  });
  return warnings;
}
