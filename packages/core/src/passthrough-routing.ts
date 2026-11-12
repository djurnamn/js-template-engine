import type {
  ElementNode,
  PassthroughRouting,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import { isDynamicTag } from './dynamic-tag';
import { passthroughNodeOf } from './passthrough';
import { visitElements } from './traverse';

/** The entry routing every attribute but `class`, `style` and `data-*`. */
export const ROUTE_ALL = '*';
/** The entry routing every `aria-` attribute. */
export const ROUTE_ARIA = 'aria-*';
/** The entry routing every event handler. */
export const ROUTE_HANDLERS = 'on*';

/**
 * The names a routing list may not name: the consumer's class and style and
 * the DOM handle stay on the root, and the rest are never attributes.
 */
export const RESERVED_ROUTED_NAMES: readonly string[] = [
  'class',
  'classname',
  'style',
  'ref',
  'element',
  'children',
  'key',
  'rest',
];

/** The name of the generated helper that selects one share of the rest. */
export const CONSUMER_ATTRIBUTES = 'consumerAttributes';

/** The name of the generated helper that joins two id-reference lists. */
export const AUTHORED_AND_CONSUMER = 'authoredAndConsumer';

/**
 * The id-reference list attributes a passthrough surface merges: where the
 * passthrough root or the routed element sets one itself and the consumer's
 * value of that name lands on it, the consumer's value joins its own, the
 * element's ids first, rather than the authored value winning.
 */
export const TOKEN_LIST_ATTRIBUTES: readonly string[] = [
  'aria-describedby',
  'aria-labelledby',
  'aria-controls',
  'aria-owns',
  'aria-details',
];

/** The component's routed element: the element below its passthrough root
 *  that takes some of the consumer's attributes. */
export interface RoutedElement {
  /** The routed element. */
  node: ElementNode;
  /** Its intrinsic tag. */
  tag: string;
  /** Its routing entries, as authored. */
  entries: readonly string[];
  /** Whether the DOM handle lands on this element rather than the root. */
  handlesRef: boolean;
}

/**
 * Whether a `passthrough` value routes attributes to an inner element (an
 * object) rather than marking the surface root (`true`).
 *
 * @param value - An element's `passthrough` value.
 * @returns `true` for a routing object.
 */
export function isPassthroughRouting(
  value: unknown
): value is PassthroughRouting {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the component's routed element, or `undefined` when it has none:
 * the first element below its single, static-tag passthrough root whose
 * `passthrough` is a routing object. A misplaced routing object is a
 * validation error reported upstream, so a returned element is
 * authoritative.
 *
 * @param children - The component's top-level nodes.
 * @returns The routed element, its tag and its entries.
 */
export function routedElementOf(
  children: readonly TemplateNode[]
): RoutedElement | undefined {
  const root = passthroughNodeOf(children);
  if (root === undefined || isDynamicTag(root.tag)) {
    return undefined;
  }
  let found: RoutedElement | undefined;
  visitElements(root.children ?? [], (element) => {
    if (
      found === undefined &&
      isPassthroughRouting(element.passthrough) &&
      typeof element.tag === 'string'
    ) {
      found = {
        node: element,
        tag: element.tag,
        entries: element.passthrough.attributes,
        handlesRef: element.passthrough.handle === 'routed',
      };
    }
  });
  return found;
}

/**
 * Whether a consumer attribute is routed by a list of entries, compared in
 * the spelling it arrives in: `aria-*` matches `aria-describedby` and the
 * camel-case `ariaDescribedby` a Vue consumer may write, `on*` any `on` name
 * followed by a letter, and an HTML name matches case-blind (`tabindex` matches `tabIndex`) or through
 * `spelling`, a target's own name for it (React's `htmlFor` for `for`).
 *
 * @param entries - The routing entries.
 * @param name - The attribute's name, in the target's spelling.
 * @param spelling - The target's spelling of an HTML attribute name.
 * @returns Whether the attribute goes to the routed element.
 */
export function isRoutedAttribute(
  entries: readonly string[],
  name: string,
  spelling: (htmlName: string) => string = (htmlName) => htmlName
): boolean {
  if (routedNames(entries, spelling).has(name.toLowerCase())) {
    return true;
  }
  if (entries.includes(ROUTE_ARIA) && /^aria-|^aria[A-Z]/.test(name)) {
    return true;
  }
  if (entries.includes(ROUTE_HANDLERS) && /^on[a-z]/i.test(name)) {
    return true;
  }
  return (
    entries.includes(ROUTE_ALL) &&
    !/^(class|classname|style)$|^data-/i.test(name)
  );
}

/** The lowercase names the exact entries match, in HTML and target spelling. */
function routedNames(
  entries: readonly string[],
  spelling: (htmlName: string) => string
): Set<string> {
  const names = new Set<string>();
  for (const entry of entries) {
    if (
      entry === ROUTE_ALL ||
      entry === ROUTE_ARIA ||
      entry === ROUTE_HANDLERS
    ) {
      continue;
    }
    names.add(entry.toLowerCase());
    names.add(spelling(entry).toLowerCase());
  }
  return names;
}

/**
 * The generated helper a scripted target declares beside a component with a
 * routed element: the share of the consumer's attributes that lands on the
 * root (`'root'`) or on the routed element (`'routed'`), each key keeping its
 * spelling. The rule is the routing list's, written out as one test. The
 * names in `omitted` are left out of either share: Vue leaves out the
 * camel-case spelling of an id list the element joins itself. With no
 * entries every attribute is the root's, which Vue uses on a passthrough
 * root that joins an id list without routing.
 *
 * @param entries - The routing entries.
 * @param spelling - The target's spelling of an HTML attribute name.
 * @param camelCaseKeys - Whether a key may spell a hyphenated name in camel
 *   case, as Vue's `$attrs` keeps a render function's `ariaDescribedby`; such
 *   a key matches a listed `aria-describedby` too.
 * @returns The TypeScript function declaration.
 * @example
 * // <input {...consumerAttributes(restProperties, 'routed')} />
 */
export function consumerAttributesDeclaration(
  entries: readonly string[],
  spelling: (htmlName: string) => string = (htmlName) => htmlName,
  camelCaseKeys = false
): string {
  const tests: string[] = [];
  const names = [...routedNames(entries, spelling)];
  if (names.length > 0) {
    tests.push(
      `[${names.map((name) => `'${name}'`).join(', ')}].includes(name.toLowerCase())`
    );
  }
  const hyphenated = names.filter((name) => name.includes('-'));
  if (camelCaseKeys && hyphenated.length > 0) {
    tests.push(
      `[${hyphenated.map((name) => `'${name}'`).join(', ')}].includes(name.replace(/[A-Z]/g, (letter) => '-' + letter).toLowerCase())`
    );
  }
  if (entries.includes(ROUTE_ARIA)) {
    tests.push('/^aria-|^aria[A-Z]/.test(name)');
  }
  if (entries.includes(ROUTE_HANDLERS)) {
    tests.push('/^on[a-z]/i.test(name)');
  }
  if (entries.includes(ROUTE_ALL)) {
    tests.push('!/^(class|classname|style)$|^data-/i.test(name)');
  }
  return [
    `function ${CONSUMER_ATTRIBUTES}<T = Record<string, unknown>>(attributes: object, share: 'root' | 'routed', omitted: readonly string[] = []): T {`,
    '  const selected: Record<string, unknown> = {};',
    '  for (const [name, value] of Object.entries(attributes)) {',
    '    if (omitted.includes(name)) continue;',
    `    const routed = ${tests.length === 0 ? 'false' : tests.join(' || ')};`,
    "    if (routed === (share === 'routed')) {",
    '      selected[name] = value;',
    '    }',
    '  }',
    '  return selected as T;',
    '}',
  ].join('\n');
}

/**
 * Whether an attribute is one of the {@link TOKEN_LIST_ATTRIBUTES}, which a
 * passthrough surface joins with the consumer's value of the same name.
 *
 * @param name - The attribute's name, in HTML spelling.
 * @returns Whether the name is an id-reference list attribute.
 * @example
 * isTokenListAttribute('aria-describedby'); // true
 */
export function isTokenListAttribute(name: string): boolean {
  return TOKEN_LIST_ATTRIBUTES.includes(name.toLowerCase());
}

/**
 * Whether an attribute the routed element sets itself merges with the
 * consumer's routed value of the same name: one of the
 * {@link TOKEN_LIST_ATTRIBUTES} that the routing list routes.
 *
 * @param entries - The routing entries.
 * @param name - The attribute's name, in HTML spelling.
 * @returns Whether the authored and consumer values join.
 */
export function mergesTokenList(
  entries: readonly string[],
  name: string
): boolean {
  return isTokenListAttribute(name) && isRoutedAttribute(entries, name);
}

/**
 * Joins an id-reference list a passthrough root or routed element sets with
 * the consumer's value for the same attribute: the element's tokens first, then the
 * consumer's, each once, or `undefined` when neither has one. `null`,
 * `undefined` and `false` contribute nothing. The same rule as the
 * generated {@link authoredAndConsumerDeclaration} helper.
 *
 * @param authored - The element's own value.
 * @param consumer - The consumer's value.
 * @returns The joined list, or `undefined`.
 * @example
 * joinTokenLists('hint error', 'help hint'); // 'hint error help'
 */
export function joinTokenLists(
  authored: unknown,
  consumer: unknown
): string | undefined {
  const tokens = [authored, consumer].flatMap((value) =>
    value === undefined || value === null || value === false
      ? []
      : String(value)
          .split(/\s+/)
          .filter((token) => token !== '')
  );
  return tokens.length === 0 ? undefined : [...new Set(tokens)].join(' ');
}

/**
 * The generated helper a scripted target declares beside a component whose
 * passthrough root or routed element sets an id-reference list attribute
 * the consumer's value of that name lands on (`aria-describedby`): the
 * element's tokens, then the consumer's value's under each name given, each token once, or `undefined` when none
 * has one. Vue passes the attribute's camel-case spelling as well, which a
 * consumer's `$attrs` may hold it under.
 *
 * @returns The TypeScript function declaration.
 * @example
 * // aria-describedby={authoredAndConsumer(hintId, routedRest, 'aria-describedby')}
 */
export function authoredAndConsumerDeclaration(): string {
  return [
    `function ${AUTHORED_AND_CONSUMER}(authored: unknown, consumer: object, ...names: string[]): string | undefined {`,
    '  const tokens = [authored, ...names.map((name) => (consumer as Record<string, unknown>)[name])].flatMap((value) =>',
    "    value === undefined || value === null || value === false ? [] : String(value).split(/\\s+/).filter((token) => token !== '')",
    '  );',
    "  return tokens.length === 0 ? undefined : [...new Set(tokens)].join(' ');",
    '}',
  ].join('\n');
}

/**
 * Describes what a routing list sends to its element, for the html target's
 * comment: `the consumer's aria-* attributes, event handlers, required and
 * form`, or, with `'*'`, `the consumer's attributes other than class, style
 * and data-*`.
 *
 * @param entries - The routing entries.
 * @returns The description, starting `the consumer's`.
 */
export function routedAttributesDescription(
  entries: readonly string[]
): string {
  const names = entries.filter(
    (entry) =>
      entry !== ROUTE_ALL && entry !== ROUTE_ARIA && entry !== ROUTE_HANDLERS
  );
  if (entries.includes(ROUTE_ALL)) {
    const extra = names.filter((name) => name.startsWith('data-'));
    return extra.length === 0
      ? "the consumer's attributes other than class, style and data-*"
      : `the consumer's attributes other than class, style and data-* (${joinList(extra)} included)`;
  }
  const parts = [
    ...(entries.includes(ROUTE_ARIA) ? ['aria-* attributes'] : []),
    ...(entries.includes(ROUTE_HANDLERS) ? ['event handlers'] : []),
    ...names,
  ];
  return `the consumer's ${joinList(parts)}`;
}

/**
 * Describes what stays on a passthrough root whose component routes
 * attributes to an inner element, for the html target's comment on the root: with
 * `'*'`, `the consumer's class, style and data-* apply here, the rest on the
 * <input>`; with a list, the consumer's other attributes, class and style,
 * the routed ones on the element.
 *
 * @param routed - The component's routed element.
 * @returns The comment text after `passthrough: `.
 */
export function routingRootDescription(routed: RoutedElement): string {
  if (routed.entries.includes(ROUTE_ALL)) {
    const routedData = routed.entries.filter((entry) =>
      entry.startsWith('data-')
    );
    const data =
      routedData.length === 0
        ? 'data-*'
        : `data-* other than ${joinList(routedData)}`;
    return `the consumer's class, style and ${data} apply here, the rest on the <${routed.tag}>`;
  }
  return `the consumer's other attributes, class and style apply here, the routed ones on the <${routed.tag}>`;
}

/**
 * Joins words as an English list: `a`, `a and b`, `a, b and c`.
 *
 * @param items - The words.
 * @returns The joined list.
 */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Warns where the routed element sits inside an iteration and its list names
 * `id` or `autofocus`: every rendered copy receives the consumer's value, so
 * the ids repeat and several elements ask for focus.
 *
 * @param children - The component's top-level nodes.
 * @param path - The path of the array holding them (`children`, or `''`).
 * @returns One warning, or none.
 */
export function collectRoutingWarnings(
  children: readonly TemplateNode[],
  path: string
): Warning[] {
  const routed = routedElementOf(children);
  if (routed === undefined) {
    return [];
  }
  const repeated = routed.entries.filter(
    (entry) => entry === 'id' || entry === 'autofocus'
  );
  if (repeated.length === 0) {
    return [];
  }
  const found = iterationPathOf(children, path, routed.node, false);
  if (found === undefined) {
    return [];
  }
  return [
    {
      message: `<${routed.tag}> receives the consumer's ${joinList(repeated)} inside an iteration, so every item it renders gets the same value`,
      nodePath: `${found}.passthrough`,
    },
  ];
}

/**
 * Whether an element sits inside an iteration among a component's nodes.
 *
 * @param children - The component's top-level nodes.
 * @param target - The element to find.
 * @returns `true` when an iteration renders it once per item.
 */
export function isInsideIteration(
  children: readonly TemplateNode[],
  target: ElementNode
): boolean {
  return iterationPathOf(children, '', target, false) !== undefined;
}

/**
 * Whether an element renders only some of the time among a component's
 * nodes: inside a conditional, or in a slot's fallback, which renders only
 * while the slot is not filled. A handle bound to it is unset meanwhile.
 *
 * @param children - The component's top-level nodes.
 * @param target - The element to find.
 * @returns `true` when the element may not be rendered.
 */
export function isInsideConditional(
  children: readonly TemplateNode[],
  target: ElementNode
): boolean {
  return (
    iterationPathOf(
      children,
      '',
      target,
      false,
      (node) => node.type === 'conditional' || node.type === 'slot'
    ) !== undefined
  );
}

/**
 * The path of `target` when it sits inside an iteration (or, with `wraps`,
 * another wrapper), else `undefined`.
 */
function iterationPathOf(
  nodes: readonly TemplateNode[],
  path: string,
  target: ElementNode,
  insideIteration: boolean,
  wraps: (node: TemplateNode) => boolean = (node) => node.type === 'iteration'
): string | undefined {
  for (const [index, node] of nodes.entries()) {
    const nodePath = `${path}[${index}]`;
    if (node === target) {
      return insideIteration ? nodePath : undefined;
    }
    let nested: Array<[readonly TemplateNode[], string]> = [];
    switch (node.type) {
      case 'element':
        nested = [[node.children ?? [], `${nodePath}.children`]];
        break;
      case 'fragment':
        nested = [[node.children, `${nodePath}.children`]];
        break;
      case 'iteration':
        nested = [[node.children, `${nodePath}.children`]];
        break;
      case 'slot':
        nested = [[node.fallback ?? [], `${nodePath}.fallback`]];
        break;
      case 'conditional':
        nested = node.conditions.map((branch, branchIndex) => [
          branch.children,
          `${nodePath}.conditions[${branchIndex}].children`,
        ]);
        break;
      default:
        break;
    }
    for (const [childNodes, childPath] of nested) {
      const found = iterationPathOf(
        childNodes,
        childPath,
        target,
        insideIteration || wraps(node),
        wraps
      );
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}
