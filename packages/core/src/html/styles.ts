import type {
  ElementNode,
  NestedStyleObject,
  OutputFile,
  StyleLayer,
  Warning,
} from '@js-template-engine/types';

import { staticTagOf } from '../dynamic-tag';
import { isExpressionBinding } from '../expression-binding';
import type { CollapseVocabulary, NormalizedComponent } from '../normalize';
import { normalizeClassList } from '../normalize';
import { visitElements, visitNodes } from '../traverse';
import {
  hasIncludes,
  hasNestedSelectors,
  planTargets,
  type TargetPlan,
} from './targeting';

/**
 * Collects all stylesheet CSS for a component: the component-level style
 * block first, then element style rules in document order, then rules
 * carried by conditional attributes (hung on their first conditional
 * class). Returns an empty string when there is nothing to emit.
 *
 * Under the `inline` stylesheet placement, element styles consisting solely of
 * plain properties render as `style` attributes instead and are skipped
 * here; styles with nested selectors always require a stylesheet.
 *
 * Two nodes sharing a selector class (one BEM element on two nodes) with
 * the same style give identical rules, and each rule is emitted once, at
 * its last node's place, where the cascade reads it; declarations in
 * another order count as the same rule. A rule inside `@layer` is never
 * merged. Nodes giving one selector different declarations keep their own
 * rules, and {@link collectSharedSelectorWarnings} warns about them.
 *
 * A `layer` wraps the collected rules in `@layer <name> { ... }` (and
 * declares the layer order ahead of it), so every target's stylesheet holds
 * the same cascade position - see {@link applyLayer}. The CSS that styling
 * extensions add once per component (`contributedCss`) comes last, outside
 * the layer, and is left out under the `inline` placement, which must not
 * gain a stylesheet for it.
 */
export function collectCss(
  component: NormalizedComponent,
  plan: TargetPlan,
  placement: string,
  language: 'css' | 'scss' = 'css',
  layer?: StyleLayer
): string {
  const chunks: string[] = [];
  // The node rules in document order; a rule several nodes give (the same
  // selector and declarations) is kept at its last place only, which is
  // where the cascade reads it in the undeduplicated stylesheet too.
  const nodeRules: string[] = [];
  const pushRules = (rules: readonly string[]): void => {
    nodeRules.push(...rules);
  };

  const serialize = (
    selector: string,
    style: NestedStyleObject,
    collapse?: readonly CollapseVocabulary[]
  ): string[] =>
    language === 'scss'
      ? [serializeRulesScss(selector, style, collapse)].filter(
          (block) => block !== ''
        )
      : serializeRules(selector, style, collapse);

  // Under language: 'scss' the component-level style string is the
  // file-scope preamble (@use / $variables / mixins / @keyframes), emitted
  // verbatim ahead of every node-derived rule (sass requires @use at the
  // top); under 'css' it is opaque component CSS in the same position.
  if (component.style !== undefined && component.style.trim() !== '') {
    chunks.push(component.style.trim());
  }

  visitElements(component.children, (element) => {
    const style = element.attributes?.style;
    // A whole-object `$expression` may sit beside static / nested / include
    // keys; the serializer skips the `$expression` key, so a mixed node still
    // emits its stylesheet rule and a pure whole-object expression emits
    // nothing (it has no selector planned, so `target` is undefined below).
    if (style !== undefined) {
      const stylesheetBound =
        placement !== 'inline' ||
        hasNestedSelectors(style) ||
        hasIncludes(style);
      const target = plan.get(element);
      if (stylesheetBound && target) {
        pushRules(
          serialize(
            target.selector,
            style,
            component.collapseVocabulary?.get(element)
          )
        );
      }
    }

    for (const conditional of element.conditionalAttributes ?? []) {
      const conditionalStyle = conditional.attributes.style;
      if (
        conditionalStyle === undefined ||
        isExpressionBinding(conditionalStyle)
      ) {
        continue;
      }
      const conditionalClasses = normalizeClassList(
        conditional.attributes.class
      );
      if (conditionalClasses.length > 0) {
        pushRules(serialize(`.${conditionalClasses[0]}`, conditionalStyle));
      }
    }
  });

  const lastIndex = new Map<string, number>();
  const identities = nodeRules.map(ruleIdentity);
  identities.forEach((identity, index) => {
    if (identity !== undefined) {
      lastIndex.set(identity, index);
    }
  });
  chunks.push(
    ...nodeRules.filter((_rule, index) => {
      const identity = identities[index];
      return identity === undefined || lastIndex.get(identity) === index;
    })
  );

  const css = applyLayer(chunks.join('\n\n'), layer, language);
  // Extension-contributed top-level rules (`@property` registrations)
  // follow everything, outside the layer: they take no part in the cascade.
  const contributed = component.contributedCss;
  if (contributed === undefined || placement === 'inline') {
    return css;
  }
  return css === '' ? contributed : `${css}\n\n${contributed}`;
}

/**
 * Warns where a selector class several styled nodes share (one BEM element
 * on two nodes) makes one node's rules style another:
 *
 * - Two nodes give one stylesheet selector different declarations. Both
 *   nodes carry the class, so each node's rule for that selector styles the
 *   other too, the later winning where they set the same property. Rules
 *   are compared one by one, keyed by their resolved selector (inside its
 *   at-rules), with declarations in any order; identical rules are emitted
 *   once by {@link collectCss}. At most one warning per later node.
 * - A rule only one node gives can also match another node sharing the
 *   class: its selector is one compound (no combinator, attribute or id,
 *   no `:not()` or `:has()`) whose every class the other node carries
 *   unconditionally, such as `.table__header:first-child` or
 *   `.table__header:hover`; or it is the shared selector itself inside an
 *   at-rule (`@media` hiding one node), where both nodes style the shared
 *   selector outside at-rules. At most one warning per node giving such
 *   rules. A rule keyed on a class the other node lacks, such as a
 *   modifier only this node carries, matches this node alone and is no
 *   conflict, and a node alone in styling the shared selector at all
 *   shares it silently.
 *
 * Only nodes whose styles reach the stylesheet are compared; a node styling
 * nothing shares the class silently. Each node is named by its start tag,
 * its classes and other literal attributes (see {@link describeNode}), and
 * its path.
 *
 * @param component - The normalized component, styling extensions applied.
 * @param placement - The stylesheet placement; under `inline`, a
 *   style of plain properties renders as a `style` attribute and shares no
 *   selector.
 * @param rootPath - The path of the component's children: `children`, or
 *   `''` for a node-array template.
 * @returns The warnings, each at the `attributes.style` of the node it is
 *   about, naming the selector and the other node.
 *
 * @example
 * // Two <th> nodes, both `table__header`, one with font-weight 600, one 400:
 * collectSharedSelectorWarnings(component, 'separate-file', 'children');
 * // → one warning naming .table__header and both nodes
 */
export function collectSharedSelectorWarnings(
  component: NormalizedComponent,
  placement: string,
  rootPath: string
): Warning[] {
  const plan = planTargets(
    component.children,
    placement,
    undefined,
    component.selectorClasses,
    component.name
  );
  const first = new Map<
    string,
    { element: ElementNode; path: string; declarations: string }
  >();
  const styled: {
    element: ElementNode;
    path: string;
    selector: string;
    entries: RuleEntry[];
  }[] = [];
  const warnings: Warning[] = [];
  visitNodes(component.children, rootPath, (node, path) => {
    if (node.type !== 'element') {
      return;
    }
    const style = node.attributes?.style;
    const target = plan.get(node);
    if (
      style === undefined ||
      target === undefined ||
      target.generatedNodeValue !== undefined ||
      (placement === 'inline' &&
        !hasNestedSelectors(style) &&
        !hasIncludes(style))
    ) {
      return;
    }
    const entries = serializeRules(
      target.selector,
      style,
      component.collapseVocabulary?.get(node)
    ).flatMap(ruleEntries);
    styled.push({ element: node, path, selector: target.selector, entries });
    let warned = false;
    for (const entry of entries) {
      const declarations = canonicalDeclarations(entry.declarations);
      const earlier = first.get(entry.selector);
      if (earlier === undefined) {
        first.set(entry.selector, { element: node, path, declarations });
        continue;
      }
      if (
        warned ||
        earlier.element === node ||
        earlier.declarations === declarations
      ) {
        continue;
      }
      warned = true;
      warnings.push({
        message:
          `The ${describeNode(earlier.element)} at ${earlier.path} and the ${describeNode(node)} here both style ${entry.selector} and give it different declarations, ` +
          "so each one's rule styles the other too, the later winning where they set the same property; " +
          'style the class on one node, or give the nodes classes of their own (a BEM modifier on one)',
        nodePath: `${path}.attributes.style`,
      });
    }
  });

  for (const own of styled) {
    const others = styled.filter(
      (other) => other !== own && other.selector === own.selector
    );
    if (others.length === 0) {
      continue;
    }
    // Whether a node styles the shared selector itself, outside at-rules.
    const stylesBase = (node: { entries: RuleEntry[] }): boolean =>
      node.entries.some(
        (entry) =>
          entry.selector === own.selector && entry.rule === own.selector
      );
    const leak = own.entries
      .map((entry) => ({
        entry,
        other: others.find((other) => {
          if (
            other.entries.some(
              (otherEntry) => otherEntry.selector === entry.selector
            )
          ) {
            return false;
          }
          if (entry.rule === own.selector) {
            // The shared selector inside an at-rule (`@media` hiding one
            // node) styles every node with the class there; a node alone in
            // styling the shared selector at all shares it on purpose.
            return (
              entry.selector !== entry.rule &&
              stylesBase(own) &&
              stylesBase(other)
            );
          }
          return compoundMatches(entry.rule, other.element);
        }),
      }))
      .find(({ other }) => other !== undefined);
    if (leak?.other === undefined) {
      continue;
    }
    warnings.push({
      message:
        `The ${describeNode(own.element)} here styles ${leak.entry.selector}, which the ${describeNode(leak.other.element)} at ${leak.other.path} can also match: ` +
        'it carries every class the selector names, so the rule can style both nodes; ' +
        'give this node a class of its own (a BEM modifier) and key the rule on it, or style the class on every node',
      nodePath: `${own.path}.attributes.style`,
    });
  }
  return warnings;
}

/**
 * Whether a rule's selector can match an element by the element's
 * unconditional classes alone: one selector of the list is a single
 * compound - no combinator, attribute selector, id or type selector, at its
 * top level or inside a pseudo-class's arguments, and no `:not()` or
 * `:has()` - whose every class the element carries outside its conditional
 * attributes, so a pseudo-class (`:hover`, `:first-child`) is all that
 * narrows it. A selector naming anything else counts as no match, so the
 * check stays silent wherever the rule may well miss the element.
 */
function compoundMatches(rule: string, element: ElementNode): boolean {
  const classes = new Set(normalizeClassList(element.attributes?.class));
  return splitSelectorList(rule).some((selector) => {
    if (
      !/^[.:]/.test(selector) ||
      /:(?:not|has)\(/.test(selector) ||
      /[\s>+~[#]/.test(selector)
    ) {
      return false;
    }
    const named = [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(
      (match) => match[1]
    );
    return named.length > 0 && named.every((name) => classes.has(name));
  });
}

/**
 * A short description of an element a human can find in the template: its
 * start tag with its classes and its other literal attributes (`style`, a
 * long value and expression values left out), such as
 * `<th class="table__header" scope="row">`.
 */
function describeNode(element: ElementNode): string {
  const parts = [staticTagOf(element.tag)];
  const classes = normalizeClassList(element.attributes?.class);
  if (classes.length > 0) {
    parts.push(`class="${classes.join(' ').replace(/"/g, '&quot;')}"`);
  }
  for (const [name, value] of Object.entries(element.attributes ?? {})) {
    if (name === 'class' || name === 'style') {
      continue;
    }
    if (value === true) {
      parts.push(name);
    } else if (
      (typeof value === 'string' && value.length <= 40) ||
      typeof value === 'number'
    ) {
      parts.push(`${name}="${String(value).replace(/"/g, '&quot;')}"`);
    }
  }
  return `<${parts.join(' ')}>`;
}

/**
 * One innermost rule of a serialized rule block: its selector inside any
 * at-rules wrapping it (joined with spaces), the rule's own selector, and
 * its declaration lines.
 */
interface RuleEntry {
  selector: string;
  rule: string;
  declarations: string[];
}

/** The innermost rules of a serialized rule block; see {@link RuleEntry}. */
function ruleEntries(rule: string): RuleEntry[] {
  const entries: RuleEntry[] = [];
  const stack: { header: string; declarations: string[] }[] = [];
  for (const line of rule.split('\n')) {
    const text = line.trim();
    if (text.endsWith('{')) {
      stack.push({ header: text.slice(0, -1).trim(), declarations: [] });
    } else if (text === '}') {
      const closed = stack.pop();
      if (closed !== undefined && closed.declarations.length > 0) {
        entries.push({
          selector: [...stack, closed].map((open) => open.header).join(' '),
          rule: closed.header,
          declarations: closed.declarations,
        });
      }
    } else if (text !== '' && stack.length > 0) {
      stack[stack.length - 1].declarations.push(text);
    }
  }
  return entries;
}

/**
 * Declarations in a canonical order, so `{ a; b }` and `{ b; a }` compare
 * equal. A block keeps its order where order matters: one holding a Sass
 * statement (`@include ...;`) or variable (`$name: ...;`), or two properties
 * that overlap (see {@link propertiesOverlap}).
 */
function canonicalDeclarations(declarations: readonly string[]): string {
  const properties = declarations.map((line) => line.split(':')[0].trim());
  const ordered =
    declarations.some((line) => line.startsWith('@') || line.startsWith('$')) ||
    properties.some((property, index) =>
      properties.some(
        (other, otherIndex) =>
          otherIndex !== index && propertiesOverlap(property, other)
      )
    )
      ? declarations
      : [...declarations].sort();
  return ordered.join('\n');
}

/**
 * Whether two properties can set the same value, so their order matters:
 * equal, or one a shorthand of the other at a `-` boundary (`margin` and
 * `margin-top`, `border` and `border-top-width`).
 */
function propertiesOverlap(first: string, second: string): boolean {
  return (
    first === second ||
    first.startsWith(`${second}-`) ||
    second.startsWith(`${first}-`)
  );
}

/**
 * A serialized node rule's identity for de-duplication: its rules'
 * selectors with their declarations in canonical order. A rule inside
 * `@layer` has none, so it is never merged.
 */
function ruleIdentity(rule: string): string | undefined {
  const entries = ruleEntries(rule);
  if (entries.some((entry) => /(^| )@layer\b/.test(entry.selector))) {
    return undefined;
  }
  return entries
    .map(
      (entry) =>
        `${entry.selector}{${canonicalDeclarations(entry.declarations)}}`
    )
    .join('\n');
}

/** Sass load at-rules, which must precede everything else in a `.scss` file. */
const SASS_LOAD_PATTERN = /^@(?:use|forward)\b/;

/**
 * The generated sass module stating the layer order, written beside each
 * `scss` stylesheet that loads it: a partial, so no component's file name
 * can meet it.
 */
export const LAYER_ORDER_MODULE_FILE = '_layer-order.scss';

/**
 * The load each `scss` stylesheet starts with under a layer order, a
 * separate one or a component file's style block.
 * Loaded without a namespace (`as *`): the module has no members, and a
 * stylesheet whose preamble loads a module of the kit's own named
 * `layer-order` would otherwise meet its namespace twice.
 */
const LAYER_ORDER_MODULE_LOAD = "@use './layer-order' as *;";

/**
 * The files a component's separate stylesheet is written as: the
 * stylesheet, and under `styling.language: 'scss'` with a `layer.order` the
 * generated module it loads first, {@link LAYER_ORDER_MODULE_FILE}, holding
 * only the order statement.
 *
 * Sass allows nothing before a stylesheet's `@use` lines and emits each
 * loaded module's CSS ahead of the stylesheet's own, so an order statement
 * written in the stylesheet compiles after what its modules emit - and a
 * module that emits rules inside one of the layers would declare that layer
 * first, reversing the order. Loading the module first puts the statement
 * first in the compiled CSS, whatever the other modules emit, and a
 * consumer compiling the stylesheet with their own sass gets the same.
 *
 * @param name - The component's name, which names the stylesheet.
 * @param css - The collected CSS, from {@link collectCss}.
 * @param styling - The stylesheet language and layer.
 * @returns The stylesheet first, then the order module when the stylesheet
 *   loads it.
 *
 * @example
 * stylesheetFiles('Chip', css, { language: 'scss', layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] } });
 * // [{ path: 'Chip.scss', content: "@use './layer-order' as *;\n..." },
 * //  { path: '_layer-order.scss', content: '@layer kit.base, kit.components;\n' }]
 */
export function stylesheetFiles(
  name: string,
  css: string,
  styling: { language?: 'css' | 'scss'; layer?: StyleLayer }
): OutputFile[] {
  const extension = styling.language === 'scss' ? 'scss' : 'css';
  return [
    { path: `${name}.${extension}`, content: `${css}\n` },
    ...layerOrderModuleFiles(css, styling),
  ];
}

/**
 * The generated layer order module, {@link LAYER_ORDER_MODULE_FILE}, when
 * the collected styles load it: under `styling.language: 'scss'` with a
 * `layer.order`, wherever they are written. A Vue or Svelte component that
 * keeps its styles in its own `<style>` block (the `in-file` and `inline`
 * placements) writes the module beside the component file, which the block
 * loads first, for the reason {@link stylesheetFiles} gives.
 *
 * @param css - The collected CSS, from {@link collectCss}.
 * @param styling - The stylesheet language and layer.
 * @returns The module, or nothing when the styles do not load it.
 *
 * @example
 * layerOrderModuleFiles(css, { language: 'scss', layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] } });
 * // [{ path: '_layer-order.scss', content: '@layer kit.base, kit.components;\n' }]
 */
export function layerOrderModuleFiles(
  css: string,
  styling: { language?: 'css' | 'scss'; layer?: StyleLayer }
): OutputFile[] {
  const order = styling.layer?.order;
  return styling.language === 'scss' &&
    order !== undefined &&
    order.length > 0 &&
    css.startsWith(LAYER_ORDER_MODULE_LOAD)
    ? [
        {
          path: LAYER_ORDER_MODULE_FILE,
          content: `@layer ${order.join(', ')};\n`,
        },
      ]
    : [];
}

/**
 * A cascade-layer *statement* (`@layer a, b, c;`) - the order-declaring form,
 * as opposed to the `@layer name { ... }` block form, which is rules.
 */
const LAYER_STATEMENT_PATTERN = /^@layer\s+[^{};]+;$/;

/**
 * Wraps collected CSS in its cascade layer, declaring the layer order ahead
 * of the wrapper when one is configured.
 *
 * A leading run of at-rules that belong at file scope is hoisted above the
 * wrapper rather than swept into it:
 *
 * - **Sass loads** (`@use`, `@forward`, under `'scss'`) must stay at the top
 *   of the file - `@use` inside `@layer` is a sass error, and a module loaded
 *   before the block emits its own CSS outside the layer.
 * - **Layer statements** (`@layer a, b, c;`, under either language) declare
 *   order, and nesting one inside a layer block declares *sub*-layers of it
 *   (`kit.components.kit.reset`) - silently, and nothing in the author's
 *   source shows why the cascade then misbehaves. A component style that
 *   already states an order keeps stating the same one.
 *
 * The configured `layer.order` is emitted per stylesheet for the same reason
 * order statements exist at all: cascade order is fixed by first declaration,
 * a per-component stylesheet may be the first thing a consumer loads, and
 * repeating an identical order costs nothing. Under `'scss'` it is a load
 * of the generated order module, first of the loads, since sass emits a
 * loaded module's CSS ahead of the stylesheet's own: in a separate
 * stylesheet (see {@link stylesheetFiles}, which writes the module beside
 * it) and in the style block a component file keeps (see
 * {@link layerOrderModuleFiles}, which writes it beside the component).
 * Under `'css'` it is the statement itself, ahead of the wrapper.
 */
function applyLayer(
  css: string,
  layer: StyleLayer | undefined,
  language: 'css' | 'scss'
): string {
  if (layer === undefined || css === '') {
    return css;
  }
  const { hoisted, rules } = splitHoistedAtRules(css, language);
  if (rules.trim() === '') {
    return css;
  }

  const sections: string[] = [];
  const hasOrder = layer.order !== undefined && layer.order.length > 0;
  const loadsOrderModule = hasOrder && language === 'scss';
  const loads = loadsOrderModule
    ? [LAYER_ORDER_MODULE_LOAD, ...hoisted]
    : hoisted;
  if (loads.length > 0) {
    sections.push(loads.join('\n'));
  }
  if (hasOrder && !loadsOrderModule) {
    sections.push(`@layer ${layer.order!.join(', ')};`);
  }
  const body = rules
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');
  sections.push(`@layer ${layer.name} {\n${body}\n}`);
  return sections.join('\n\n');
}

/**
 * Splits the leading run of file-scope at-rules off collected CSS. A sass
 * load may span lines (`@use 'x' with (...)`), so it runs to its terminating
 * `;`; blank lines and comments between them stay in the run, and anything
 * else ends it - including a `@layer name { ... }` block, which is rules and
 * belongs inside the wrapper.
 */
function splitHoistedAtRules(
  css: string,
  language: 'css' | 'scss'
): { hoisted: string[]; rules: string } {
  const lines = css.split('\n');
  let index = 0;
  let lastHoisted = -1;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (line === '' || line.startsWith('//') || line.startsWith('/*')) {
      index += 1;
      continue;
    }
    if (LAYER_STATEMENT_PATTERN.test(line)) {
      lastHoisted = index;
      index += 1;
      continue;
    }
    if (
      language !== 'scss' ||
      !SASS_LOAD_PATTERN.test(line) ||
      line.includes('{')
    ) {
      break;
    }
    while (index < lines.length && !lines[index].trimEnd().endsWith(';')) {
      index += 1;
    }
    lastHoisted = index;
    index += 1;
  }
  if (lastHoisted === -1) {
    return { hoisted: [], rules: css };
  }
  return {
    hoisted: lines
      .slice(0, lastHoisted + 1)
      .filter((line) => line.trim() !== ''),
    rules: lines
      .slice(lastHoisted + 1)
      .join('\n')
      .replace(/^\n+/, ''),
  };
}

/**
 * Serializes a nested style object into CSS rule blocks for a selector.
 * Pseudo-selector keys append to the selector, keys containing `&`
 * substitute it, and at-rule keys (`@media ...`) wrap their rules; the
 * shapes compose recursively, at-rules wrapping outermost. Expression
 * values are runtime values and never enter generated CSS.
 */
export function serializeRules(
  selector: string,
  style: NestedStyleObject,
  collapse?: readonly CollapseVocabulary[]
): string[] {
  const rules: string[] = [];
  const declarations: string[] = [];

  for (const [key, value] of Object.entries(style)) {
    // Sass source keys (`$include`, `@include ...`) never enter flattened CSS -
    // resolution consumes them ahead of this serializer under language: 'css'.
    // The whole-object `$expression` is a runtime value (dynamic mechanism),
    // never a stylesheet declaration. Array and boolean values belong to the
    // Sass keys; skip any other to stay defensive.
    if (
      key === '$expression' ||
      key === '$include' ||
      key.startsWith('@include') ||
      value === undefined
    ) {
      continue;
    }
    if (typeof value === 'object' || typeof value === 'boolean') {
      continue;
    }
    declarations.push(`  ${toKebabCaseProperty(key)}: ${value};`);
  }

  if (declarations.length > 0) {
    rules.push(`${selector} {\n${declarations.join('\n')}\n}`);
  }

  for (const [key, value] of Object.entries(style)) {
    if (
      key === '$include' ||
      key.startsWith('@include') ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      isExpressionBinding(value)
    ) {
      continue;
    }
    if (key.startsWith('@')) {
      const wrapped = serializeRules(selector, value, collapse)
        .join('\n\n')
        .split('\n')
        .map((line) => (line === '' ? line : `  ${line}`))
        .join('\n');
      rules.push(`${key} {\n${wrapped}\n}`);
    } else {
      const resolved = resolveKey(key, selector, collapse);
      if (resolved !== '') {
        rules.push(...serializeRules(resolved, value, collapse));
      }
    }
  }

  return rules;
}

/**
 * Serializes a nested style object into a single nested SCSS rule block for
 * a selector - the `styling.language: 'scss'` counterpart of
 * `serializeRules`. Plain declarations come first, then each nested key as a
 * nested block: pseudo-selector keys become `&:hover`, parent-modifier keys
 * (`.ancestor &`) and at-rule keys (`@media ...`) nest verbatim, composing
 * recursively. Sass resolves the result to the same selectors and cascade
 * the flat CSS path emits by hand. Expression values never enter the
 * stylesheet.
 */
export function serializeRulesScss(
  selector: string,
  style: NestedStyleObject,
  collapse?: readonly CollapseVocabulary[]
): string {
  return serializeScssBlock(selector, style, 0, selector, collapse);
}

/**
 * @param ampSelector - The absolute selector `&` resolves to at this nesting
 *   level (the node selector at the top, unchanged through at-rules). Drives
 *   the BEM vocabulary collapse, which fires only where `&` is the node's
 *   own base class.
 */
function serializeScssBlock(
  selector: string,
  style: NestedStyleObject,
  depth: number,
  ampSelector: string,
  collapse: readonly CollapseVocabulary[] | undefined
): string {
  const indent = '  '.repeat(depth);
  const inner = '  '.repeat(depth + 1);
  const declarations: string[] = [];
  const nested: string[] = [];

  for (const [key, value] of Object.entries(style)) {
    if (key === '$include') {
      for (const statement of includeStatements(value)) {
        declarations.push(`${inner}@include ${statement};`);
      }
      continue;
    }
    if (key.startsWith('@include')) {
      // The `@include ...` at-rule key is itself the statement (mixin name plus
      // any arguments). A non-empty object value is a content block -
      // `@include name { ... }` - emitted in authored order alongside sibling
      // declarations so include-then-override cascades as written. `true` or
      // an empty object is a no-content `@include name;` statement: Dart Sass
      // rejects `@include name {}` for a content-free mixin, so no braces.
      if (isIncludeContent(value)) {
        declarations.push(
          serializeScssBlock(key, value, depth + 1, ampSelector, collapse)
        );
      } else {
        declarations.push(`${inner}${key};`);
      }
      continue;
    }
    if (
      key === '$expression' ||
      value === undefined ||
      typeof value === 'object' ||
      typeof value === 'boolean'
    ) {
      continue;
    }
    declarations.push(`${inner}${toKebabCaseProperty(key)}: ${value};`);
  }

  for (const [key, value] of Object.entries(style)) {
    if (
      key === '$include' ||
      key.startsWith('@include') ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      isExpressionBinding(value)
    ) {
      continue;
    }
    // Each selector of a list (`&.a--x, &.b--y`) nests and collapses on its
    // own; an at-rule key is one selector.
    const nestedSelector = (key.startsWith('@') ? [key] : listMembers(key))
      .filter((part) => !namesForeignModifier(part, ampSelector, collapse))
      .map((part) => {
        const matched = collapseMatch(part, ampSelector, collapse);
        return matched
          ? part.replace(`.${matched.baseClass}`, '') // &.card--featured → &--featured
          : isSelfKey(part)
            ? '&' // `:is(&)` too, so a collapse inside still appends to the base
            : scssNestedSelector(part);
      })
      .join(', ');
    if (nestedSelector === '') {
      continue; // a key of commas alone, or of dropped selectors, has none
    }
    // What `&` resolves to inside the child block: unchanged through
    // at-rules, otherwise the child's own resolved selector.
    const childAmp = key.startsWith('@')
      ? ampSelector
      : resolveKey(key, ampSelector, collapse);
    const block = serializeScssBlock(
      nestedSelector,
      value,
      depth + 1,
      childAmp,
      collapse
    );
    if (block !== '') {
      nested.push(block);
    }
  }

  // A blank line separates the declaration group from each nested block,
  // matching idiomatic (prettier-style) SCSS. An empty block emits nothing,
  // mirroring the flat CSS path.
  const groups: string[] = [];
  if (declarations.length > 0) {
    groups.push(declarations.join('\n'));
  }
  groups.push(...nested);
  if (groups.length === 0) {
    return '';
  }
  return `${indent}${selector} {\n${groups.join('\n\n')}\n${indent}}`;
}

/**
 * The selectors of a nested style key's comma-separated list. In a list where
 * some member holds `&`, a member without one that isn't a bare
 * pseudo/attribute selector keeps its nested-selector meaning, a descendant
 * of the parent (`&:disabled, a.x` → `&:disabled, & a.x`), as it does when
 * the list nests whole.
 */
function listMembers(key: string): string[] {
  const parts = splitSelectorList(key);
  if (parts.length < 2 || !parts.some((part) => part.includes('&'))) {
    return parts;
  }
  return parts.map((part) =>
    part.includes('&') || /^[:[]/.test(part) ? part : `& ${part}`
  );
}

/**
 * The selector a nested style key takes inside a parent SCSS block. At-rules
 * (`@media ...`) and keys carrying an explicit parent reference (`.x &`)
 * nest verbatim; a bare pseudo/attribute key is prefixed with `&` so it
 * attaches to the parent (`:hover` → `&:hover`).
 */
function scssNestedSelector(key: string): string {
  if (key.startsWith('@') || key.includes('&')) {
    return key;
  }
  return `&${key}`;
}

/**
 * Resolves a nested style key (other than an at-rule) to its absolute
 * selector against the selector `&` currently denotes, each selector of a
 * comma-separated list on its own: a self-compound modifier of the node's
 * vocabulary collapses (see {@link collapseMatch}) and the others resolve
 * as {@link resolveSelector} does, so `&.cell--numeric, &.is-numeric` on
 * a `.cell` node gives `.cell--numeric, .cell.is-numeric`. A selector
 * naming a modifier of another element of the node's block is dropped (see
 * {@link namesForeignModifier}), so `&.table__cell--numeric,
 * &.table__header--numeric` on the `table__cell` node gives
 * `.table__cell--numeric`. Where `&` denotes a list itself (a key nested
 * under a list key), each selector resolves against each of the list's
 * selectors.
 */
function resolveKey(
  key: string,
  ampSelector: string,
  collapse: readonly CollapseVocabulary[] | undefined
): string {
  const parts = listMembers(key);
  // Under a parent list, each selector resolves against each parent one.
  return splitSelectorList(ampSelector)
    .flatMap((parent) =>
      parts
        .filter((part) => !namesForeignModifier(part, parent, collapse))
        .map((part) =>
          resolveSelector(part, parent, collapseMatch(part, parent, collapse))
        )
    )
    .join(', ');
}

/**
 * Whether a self-compound nested key names a modifier of another element of
 * the node's own BEM block (`&.table__header--numeric` on the `table__cell`
 * node), where `&` denotes the node's base class and the BEM extension
 * declares the node can carry no class of another element of its block. No
 * such node carries the class, so the selector can never match, and is
 * dropped: a style object shared between elements may key each element's
 * modifier, and each node keeps its own.
 */
function namesForeignModifier(
  key: string,
  ampSelector: string,
  collapse: readonly CollapseVocabulary[] | undefined
): boolean {
  const className = /^&\.(-?[_a-zA-Z][\w-]*)/.exec(key)?.[1];
  if (className === undefined || collapse === undefined) {
    return false;
  }
  return collapse.some(
    ({ baseClass, modifierSeparator, block, elementSeparator }) => {
      if (
        block === undefined ||
        elementSeparator === undefined ||
        ampSelector !== `.${baseClass}`
      ) {
        return false;
      }
      const elementPrefix = `${block}${elementSeparator}`;
      if (!className.startsWith(elementPrefix)) {
        return false;
      }
      const separatorIndex = className.indexOf(
        modifierSeparator,
        elementPrefix.length
      );
      return (
        separatorIndex > elementPrefix.length &&
        className.slice(0, separatorIndex) !== baseClass
      );
    }
  );
}

/**
 * Splits a selector list at its top-level commas, leaving the commas inside
 * parentheses, brackets and quoted strings (`:is(&, .x)`, `[data-a="1,2"]`),
 * each selector trimmed. A key without a top-level comma is one selector.
 */
function splitSelectorList(key: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | undefined;
  for (let i = 0; i < key.length; i += 1) {
    const character = key[i];
    if (quote !== undefined) {
      if (character === '\\') i += 1;
      else if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === ',' && depth === 0) {
      parts.push(key.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (parts.length === 0) {
    return [key];
  }
  parts.push(key.slice(start).trim());
  // An empty selector (a trailing or doubled comma) would stand for the
  // whole parent selector, widening the rule, so it is dropped.
  const selectors = parts.filter((part) => part !== '');
  // A key of commas alone has no selector, and emits nothing.
  return selectors;
}

/**
 * Resolves a nested style key (other than an at-rule) to its absolute
 * selector against the selector `&` currently denotes. A matched BEM
 * vocabulary collapse drops the duplicated base class (`&.Block--mod` →
 * `.Block--mod`); otherwise `&` substitutes and a bare pseudo/attribute key
 * appends.
 */
function resolveSelector(
  key: string,
  ampSelector: string,
  matched: CollapseVocabulary | undefined
): string {
  if (matched !== undefined) {
    return key.replace(/&/g, '');
  }
  if (isSelfKey(key)) {
    return ampSelector;
  }
  if (key.includes('&')) {
    return key.replace(/&/g, ampSelector);
  }
  return `${ampSelector}${key}`;
}

/**
 * Whether a nested key stands for the selector itself - `&`, or `&` wrapped
 * in `:is()` (`:is(&)`, `:is(:is(&))`), which matches the same elements
 * with the same specificity. Such a key leaves the selector `&` denotes
 * unchanged, so a BEM collapse inside it still sees the node's base class.
 */
export function isSelfKey(key: string): boolean {
  let inner = key;
  while (inner.startsWith(':is(') && inner.endsWith(')')) {
    inner = inner.slice(4, -1);
  }
  return inner === '&';
}

/**
 * Finds the BEM vocabulary a self-compound nested key collapses against:
 * the key compounds a modifier of the node's own base class
 * (`&.{baseClass}{modifierSeparator}...`) and `&` currently denotes that base
 * (`.{baseClass}`). Returns `undefined` when no vocabulary matches -
 * out-of-vocabulary compounds (`&.is-open`) and runs without `bem()` emit
 * the compound as written.
 */
function collapseMatch(
  key: string,
  ampSelector: string,
  collapse: readonly CollapseVocabulary[] | undefined
): CollapseVocabulary | undefined {
  if (collapse === undefined || !key.startsWith('&.')) {
    return undefined;
  }
  return collapse.find(
    ({ baseClass, modifierSeparator }) =>
      ampSelector === `.${baseClass}` &&
      key.startsWith(`&.${baseClass}${modifierSeparator}`)
  );
}

/** Normalizes a `$include` value to its list of `@include` statements. */
function includeStatements(value: unknown): string[] {
  const statements = Array.isArray(value) ? value : [value];
  return statements.filter(
    (statement): statement is string => typeof statement === 'string'
  );
}

/**
 * Whether an `@include ...` at-rule key's value is a content block: a non-empty
 * plain object. `true`, an empty object, an array, and an expression binding
 * are all no-content (the include emits as a bare `@include name;` statement).
 */
function isIncludeContent(value: unknown): value is NestedStyleObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isExpressionBinding(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Serializes static plain style properties as an inline `style` attribute
 * value. Nested selector blocks belong to a stylesheet and expression
 * values to the target's dynamic style mechanism; both are ignored here.
 */
export function serializeInlineStyle(style: NestedStyleObject): string {
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (
      key === '$expression' ||
      key === '$include' ||
      key.startsWith('@include')
    ) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      declarations.push(`${toKebabCaseProperty(key)}: ${value}`);
    }
  }
  return declarations.join('; ');
}

/**
 * Converts a camelCase CSS property name to its kebab-case form. A CSS custom
 * property (`--badge-size`, `--kit-component--Badge--size`) passes through
 * untouched: custom property names are case-sensitive, and a capital in one
 * is part of the name, not a word boundary.
 */
export function toKebabCaseProperty(propertyName: string): string {
  if (propertyName.startsWith('--')) return propertyName;
  return propertyName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
