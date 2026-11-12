import type {
  Attributes,
  ElementNode,
  Extension,
  NestedStyleObject,
  PropDefinition,
  SlotNode,
  StylesheetPlacement,
  Template,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import { isPropertyOnlyName } from '../boolean-attributes';
import { quoteClassAttributeValue } from '../class-list';
import { declaredIdsOf, RestIdCounter } from '../declared-ids';
import { derivedValuesOf } from '../derived-values';
import { isDynamicTag, staticTagOf } from '../dynamic-tag';
import {
  isExpressionBinding,
  nodeSpreads,
  wholeStyleExpression,
} from '../expression-binding';
import {
  flattenTemplateLiterals,
  readExpressionIdentifiers,
  tokenizeExpression,
} from '../expression-scope';
import { classExpressions, normalizeClassList } from '../normalize';
import { normalizeTemplate, type NormalizedComponent } from '../normalize';
import {
  isRoutedAttribute,
  isTokenListAttribute,
  joinTokenLists,
  routedElementOf,
  type RoutedElement,
} from '../passthrough-routing';
import {
  collectNamedSlotNames,
  normalizeExposes,
  normalizeNamedSlots,
} from '../slots';
import { applyStylingExtensions } from '../styling-extensions';
import {
  holdsOnlyFunctions,
  relayedBindingsOf,
  twoWayBindingsOf,
} from '../two-way-bindings';
import { validateTemplate } from '../validate';
import { escapeAttributeValue, escapeText } from './escape';
import { isComponentReference } from './markup';
import { evaluateModuleDeclarations, type ModuleScope } from './module-scope';
import { printNodes, type OutputNode } from './serialize';
import { toKebabCaseProperty } from './styles';
import {
  GENERATED_NODE_ATTRIBUTE,
  planTargets,
  type TargetPlan,
} from './targeting';

/**
 * Content for one slot of a rendered instance: markup, inserted as given, or
 * template nodes, rendered with no props in scope. A component reference
 * among the nodes is resolved like any other. Nodes given as
 * `{ content, slotScope }` read the values the slot exposes under those
 * names, as a scoped slot's content does.
 */
export type InstanceSlotContent =
  | string
  | TemplateNode[]
  | { content: TemplateNode[]; slotScope?: string[] };

/** Slot content as the walk keeps it. */
type ProjectedContent = string | TemplateNode[];

/**
 * A component written by hand for each target - a driver, say - as the
 * instance render shows it: only the content passed into it, at rest, or the
 * template it renders, given the reference's props and content. Either way
 * one comment around it says its behavior is not included.
 */
export interface HandWrittenComponent {
  rendersAs: 'content' | Template;
  /**
   * The component's own props. One the template it renders does not declare
   * is dropped, rather than passed on as an attribute.
   */
  props?: readonly string[];
  /**
   * The template's slot each of the component's slots fills, where they
   * differ - `{ default: 'inner' }` for a component that puts its children
   * in the template's `inner` slot. `default` names the default slot.
   */
  slots?: Readonly<Record<string, string>>;
}

/** Options for {@link renderInstance}. */
export interface RenderInstanceOptions {
  /** Used when the template has no component node. Defaults to `'Component'`. */
  componentName?: string;
  /**
   * The values of the instance's props. A declared prop left out takes its
   * default; a value that is not a declared prop is an attribute the
   * consumer passes, landing on the passthrough root or in `rest`.
   */
  props?: Record<string, unknown>;
  /** Content for the default slot. */
  children?: InstanceSlotContent;
  /** Content for named slots, keyed by slot name. */
  slots?: Record<string, InstanceSlotContent>;
  /**
   * Returns the template a component reference names, so it renders inline,
   * or how a component written by hand renders. A tag it does not resolve is
   * left out and listed in the result's `unresolved`.
   */
  resolveComponent?: (
    tag: string
  ) => Template | HandWrittenComponent | undefined;
  /**
   * Values every expression can read, under their names - the helpers a
   * template imports from the kit's shared scripts, say. A component's props,
   * loop variables and slot bindings shadow them.
   */
  scope?: Record<string, unknown>;
  /** Styling extensions, applied as `process()` applies them. */
  extensions?: Extension[];
  /**
   * The stylesheet placement the kit's stylesheets were built with; it
   * decides which elements carry a `data-jte-node` selector. Defaults to
   * `'in-file'`.
   */
  placement?: StylesheetPlacement;
}

/** The result of {@link renderInstance}. */
export interface InstanceResult {
  /** The resolved markup. */
  markup: string;
  /** Expressions that could not be evaluated, and other notices. */
  warnings: Warning[];
  /**
   * The components the markup leaves out: tags `resolveComponent` did not
   * resolve, and dynamic tags whose value is a component. When it is not
   * empty, the markup is not the whole instance.
   */
  unresolved: string[];
}

/** The deepest a chain of component references may nest. */
const MAXIMUM_DEPTH = 32;

/** Values in scope, by identifier. */
type Scope = ReadonlyMap<string, unknown>;

/** Content projected into a slot, with the scope and component it was written in. */
interface Projection {
  content: ProjectedContent;
  scope: Scope;
  frame: Frame | undefined;
  slotScope: readonly string[];
}

/** One component being rendered. */
interface Frame {
  component: NormalizedComponent;
  plan: TargetPlan;
  /** Projections by slot name; the default slot under `undefined`. */
  projections: ReadonlyMap<string | undefined, Projection>;
  /** Attributes the consumer passed that are not declared props. */
  extras: Record<string, unknown>;
  passthroughRoot: ElementNode | undefined;
  /** The element below the passthrough root that takes part of the extras. */
  routed: RoutedElement | undefined;
  depth: number;
}

interface RenderState {
  options: RenderInstanceOptions;
  warnings: Warning[];
  unresolved: string[];
  compiled: Map<string, (...values: unknown[]) => unknown>;
  /** Each module scope worked out, by its imports lines. */
  modules: Map<string, ModuleScope>;
  /** The names each expression reads free, by the expression. */
  freeNames: Map<string, Set<string>>;
  /** Numbers each declared id through the render, per prefix. */
  ids: RestIdCounter;
}

/** Thrown inside the walk when an expression cannot be evaluated. */
class Unresolved {
  /**
   * @param expression - The expression and why it failed.
   * @param atRest - Whether it failed reading a value a hand-written
   *   component would expose, which has none at rest by design: its result
   *   is left out without a warning.
   */
  constructor(
    readonly expression: string,
    readonly atRest = false
  ) {}
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * A value a slot exposes, worked out the first time an expression reads it:
 * one the content never reads is never evaluated, so it cannot warn.
 */
class Deferred {
  private settled = false;
  private value: unknown;

  constructor(private readonly work: () => unknown) {}

  /** The value, worked out once. */
  read(): unknown {
    if (!this.settled) {
      this.value = this.work();
      this.settled = true;
    }
    return this.value;
  }
}

/**
 * A name in scope with no value at rest: a prop a component reference passes
 * through an expression that could not be evaluated, or a declaration on the
 * `imports` lines that could not run. It reads as unset rather than
 * `undefined`: an expression naming it fails in turn, so an id built from it
 * is left out, with a warning, instead of printing `undefined`.
 */
class Unevaluated {
  constructor(readonly reason: string) {}
}

/**
 * What a value a hand-written component exposes reads as: every property is
 * `undefined`, so `api.open` is falsy and `api.label || placeholder` falls
 * through, while a call such as `api.getRootProps()` fails and its result is
 * left out. Its behavior is not included at rest, so such a failure is no
 * warning: the component's comment already says so.
 */
const INERT: unknown = new Proxy(Object.create(null), {
  get: () => undefined,
});

/**
 * Renders one instance of a template to static markup, for given props and
 * slot content, at build time.
 *
 * Expressions are evaluated as JavaScript against the props (defaults
 * applied), the value of each two-way prop (the given value, else its
 * default prop's or its own default) and a setter that does nothing, each
 * declared id (the prop's value when given, else `prefix-1`, `prefix-2` and
 * so on, counted per prefix through the render), each
 * derived value (its expression evaluated in order against those), loop
 * items and indexes, slot presence and the values a scoped slot exposes; only the branch a conditional takes renders, loops expand,
 * and styling extensions' classes are applied as in `process()`. Component
 * references resolve through `resolveComponent` and render inline, the
 * content projected into them filling their slots. The output has no script
 * and assumes the kit's stylesheet: static styles stay in the stylesheet,
 * and only styles computed from expressions are written inline.
 *
 * Every element in the output is real markup. A component written by hand
 * renders as its content or as the template it names, inside one comment
 * saying its behavior is not included; content it is given renders at rest,
 * the values it would expose reading every property as `undefined`. A
 * component reference that does not resolve is left out and listed in
 * `unresolved`. An expression that throws - one
 * naming a value only a component script or a driver defines, say - is left
 * out, with a warning. Events are behavior and leave no trace.
 *
 * @param template - The template to render.
 * @param options - The instance's props and slot content, and how to resolve
 *   the components it references.
 * @returns The markup and any warnings.
 *
 * @example
 * const { markup } = renderInstance(button, {
 *   props: { variant: 'dense' },
 *   children: 'Save',
 *   extensions: [bem()],
 * });
 */
export function renderInstance(
  template: Template,
  options: RenderInstanceOptions = {}
): InstanceResult {
  const state: RenderState = {
    options,
    warnings: [],
    unresolved: [],
    compiled: new Map(),
    modules: new Map(),
    freeNames: new Map(),
    ids: new RestIdCounter(),
  };
  const projections = new Map<string | undefined, Projection>();
  const outside: Scope = new Map(Object.entries(options.scope ?? {}));
  const project = (name: string | undefined, given: InstanceSlotContent) => {
    const scoped = typeof given === 'object' && !Array.isArray(given);
    projections.set(name, {
      content: scoped ? given.content : given,
      scope: outside,
      frame: undefined,
      slotScope: scoped ? (given.slotScope ?? []) : [],
    });
  };
  if (options.children !== undefined) {
    project(undefined, options.children);
  }
  for (const [name, content] of Object.entries(options.slots ?? {})) {
    project(name, content);
  }
  const output = renderComponent(
    template,
    options.componentName ?? 'Component',
    options.props ?? {},
    projections,
    0,
    state
  );
  return {
    markup: printNodes(output),
    warnings: state.warnings,
    unresolved: state.unresolved,
  };
}

function renderComponent(
  template: Template,
  componentName: string,
  givenProps: Record<string, unknown>,
  projections: ReadonlyMap<string | undefined, Projection>,
  depth: number,
  state: RenderState,
  withheld: ReadonlySet<string> = new Set()
): OutputNode[] {
  validateTemplate(template, { extensions: state.options.extensions });
  const styled = applyStylingExtensions(
    normalizeTemplate(template, componentName),
    state.options.extensions ?? []
  );
  state.warnings.push(...styled.warnings);
  const component = styled.component;

  const declared = declaredProps(component);
  const scope = new Map<string, unknown>(
    Object.entries(state.options.scope ?? {})
  );
  // The declarations on the imports lines, which every instance shares.
  const moduleScope = moduleScopeOf(component.imports, state);
  for (const [name, value] of moduleScope.values) {
    scope.set(name, value);
  }
  for (const [name, reason] of moduleScope.failures) {
    scope.set(
      name,
      new Unevaluated(`${name} on an imports line could not run: ${reason}`)
    );
  }
  const props: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};
  const bindings = twoWayBindingsOf(component.props);
  // A two-way prop keeps no default of its own: its default seeds the
  // component's own copy, which `current` reads when the prop is not given.
  const twoWayProps = new Set(bindings.map((binding) => binding.prop));
  for (const [name, definition] of Object.entries(declared)) {
    props[name] = twoWayProps.has(name) ? undefined : definition.default;
  }
  // A prop the reference could not evaluate is not given: its default
  // applies, and one with none stays unset for the expressions here that
  // name it bare (`props.name` reads `undefined`).
  const unevaluated = new Map<string, Unevaluated>();
  for (const [name, value] of Object.entries(givenProps)) {
    if (value instanceof Unevaluated) {
      if (name in declared && props[name] === undefined) {
        unevaluated.set(name, value);
      }
    } else if (name in declared) {
      if (value !== undefined) {
        props[name] = value;
      }
    } else if (!withheld.has(name)) {
      extras[name] = value;
    }
  }
  for (const [name, value] of Object.entries(props)) {
    scope.set(name, unevaluated.get(name) ?? value);
  }
  // At rest the setter is never called: events leave no trace.
  for (const binding of bindings) {
    const given = props[binding.prop];
    const current =
      given !== undefined
        ? given
        : binding.defaultProp !== undefined
          ? props[binding.defaultProp]
          : binding.definition.default;
    // The own copy's default applies; with none, the value stays unset.
    scope.set(
      binding.current,
      current === undefined
        ? (unevaluated.get(binding.prop) ?? current)
        : current
    );
    scope.set(binding.setter, () => undefined);
  }
  // A relayed value is the prop as given; its owner is not rendered here,
  // and nothing reports.
  for (const binding of relayedBindingsOf(component.props)) {
    scope.set(
      binding.given,
      unevaluated.get(binding.prop) ?? props[binding.prop]
    );
    scope.set(binding.report, () => undefined);
  }
  scope.set('props', props);
  for (const name of collectNamedSlotNames(component.children)) {
    if (!(name in declared)) {
      scope.set(name, projections.has(name));
    }
  }
  if (component.rest !== undefined) {
    scope.set('rest', extras);
  }

  const frame: Frame = {
    component,
    plan: planTargets(
      component.children,
      state.options.placement ?? 'in-file',
      undefined,
      component.selectorClasses,
      component.name
    ),
    projections,
    extras,
    passthroughRoot: undefined,
    routed: routedElementOf(component.children),
    depth,
  };
  // Each declared id: the consumer's prop value when given, else the next
  // `prefix-N` of the render, so every instance on the page has its own.
  for (const id of declaredIdsOf(component)) {
    const given = id.prop === undefined ? undefined : props[id.prop];
    scope.set(
      id.name,
      typeof given === 'string' ? given : state.ids.next(id.prefix)
    );
  }
  // Each derived value at rest, in order, so a later one reads an earlier
  // one; one that cannot be evaluated warns and stays unset, and so does
  // anything reading it.
  for (const value of derivedValuesOf(component)) {
    try {
      scope.set(value.name, evaluate(value.expression, scope, state));
    } catch (error) {
      warn(error, frame, state);
    }
  }
  return renderNodes(component.children, scope, frame, state);
}

/** The module scope of a component's imports lines, worked out once per render. */
function moduleScopeOf(
  lines: readonly string[],
  state: RenderState
): ModuleScope {
  const key = lines.join('\n');
  let moduleScope = state.modules.get(key);
  if (moduleScope === undefined) {
    moduleScope = evaluateModuleDeclarations(
      lines,
      new Map(Object.entries(state.options.scope ?? {}))
    );
    state.modules.set(key, moduleScope);
  }
  return moduleScope;
}

/** The component's props, a discriminated root's branch props included. */
function declaredProps(
  component: NormalizedComponent
): Record<string, PropDefinition> {
  const declared: Record<string, PropDefinition> = { ...component.props };
  for (const node of component.children) {
    if (node.type !== 'conditional') {
      continue;
    }
    for (const branch of node.conditions) {
      for (const [name, definition] of Object.entries(branch.props ?? {})) {
        if (!(name in declared) || declared[name].default === undefined) {
          declared[name] = definition;
        }
      }
    }
  }
  return declared;
}

function renderNodes(
  nodes: readonly TemplateNode[],
  scope: Scope,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  return nodes.flatMap((node) => renderNode(node, scope, frame, state));
}

function renderNode(
  node: TemplateNode,
  scope: Scope,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  switch (node.type) {
    case 'element':
      return isComponentReference(node)
        ? renderReference(node, scope, frame, state)
        : renderElement(node, scope, frame, state);
    case 'text':
      if (node.content !== undefined) {
        return [{ kind: 'text', text: escapeText(node.content) }];
      }
      return attempt(state, frame, () => {
        const text = textOf(evaluate(String(node.expression), scope, state));
        return text === '' ? [] : [{ kind: 'text', text: escapeText(text) }];
      });
    case 'comment':
      return [{ kind: 'comment', text: node.content }];
    case 'fragment':
      return renderNodes(node.children, scope, frame, state);
    case 'slot':
      return renderSlot(node, scope, frame, state);
    case 'conditional':
      for (const branch of node.conditions) {
        if (branch.statement === 'else') {
          return renderNodes(branch.children, scope, frame, state);
        }
        const condition = String(branch.condition);
        let taken: boolean;
        try {
          taken = Boolean(evaluate(condition, scope, state));
        } catch (error) {
          return dropUnresolved(error, frame, state);
        }
        if (taken) {
          return renderNodes(branch.children, scope, frame, state);
        }
      }
      return [];
    case 'iteration':
      return attempt(state, frame, () => {
        const items = evaluate(node.items, scope, state);
        if (items === undefined || items === null) {
          return [];
        }
        const output: OutputNode[] = [];
        Array.from(items as Iterable<unknown>).forEach((item, index) => {
          const inner = new Map(scope);
          inner.set(node.item, item);
          if (node.index !== undefined) {
            inner.set(node.index, index);
          }
          output.push(...renderNodes(node.children, inner, frame, state));
        });
        return output;
      });
    default:
      return [];
  }
}

/**
 * A slot renders the content projected into it, in the scope it was written
 * in plus the values the slot exposes, or its fallback when nothing is.
 */
function renderSlot(
  node: SlotNode,
  scope: Scope,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  const projection = frame.projections.get(node.name);
  if (projection === undefined) {
    return renderNodes(node.fallback ?? [], scope, frame, state);
  }
  if (typeof projection.content === 'string') {
    return projection.content === ''
      ? []
      : [{ kind: 'markup', markup: projection.content }];
  }
  const inner = new Map(projection.scope);
  // A name the content takes that the slot does not expose reads as nothing.
  for (const name of projection.slotScope) {
    inner.set(name, INERT);
  }
  for (const binding of normalizeExposes(node.exposes)) {
    if (!projection.slotScope.includes(binding.name)) {
      continue;
    }
    inner.set(
      binding.name,
      new Deferred(() => {
        try {
          return evaluate(binding.value, scope, state);
        } catch (error) {
          // A value the slot cannot work out reads as nothing, as a
          // hand-written component's do, so the content still renders at rest.
          warn(error, frame, state);
          return INERT;
        }
      })
    );
  }
  if (projection.frame === undefined) {
    return renderLoose(projection.content, inner, frame.depth, state);
  }
  return renderNodes(projection.content, inner, projection.frame, state);
}

/**
 * Template nodes passed in from outside any template: rendered against an
 * empty component, so their component references still resolve.
 */
function renderLoose(
  nodes: TemplateNode[],
  scope: Scope,
  depth: number,
  state: RenderState
): OutputNode[] {
  const component = normalizeTemplate(nodes, 'Content');
  const frame: Frame = {
    component,
    plan: new Map(),
    projections: new Map(),
    extras: {},
    passthroughRoot: undefined,
    routed: undefined,
    depth,
  };
  return renderNodes(nodes, scope, frame, state);
}

/**
 * A component reference renders the template it resolves to, with its
 * attributes as props and its children and `slots` as projections. A
 * hand-written one renders those projections or its template inside a
 * behavior comment; one that does not resolve is left out.
 */
function renderReference(
  node: ElementNode,
  scope: Scope,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  const tag = staticTagOf(node.tag);
  const resolved = state.options.resolveComponent?.(tag);
  const projections = new Map<string | undefined, Projection>();
  if ((node.children?.length ?? 0) > 0) {
    projections.set(undefined, {
      content: node.children ?? [],
      scope,
      frame,
      slotScope: node.slotScope ?? [],
    });
  }
  for (const slot of normalizeNamedSlots(node.slots)) {
    projections.set(slot.name, {
      content: slot.content,
      scope,
      frame,
      slotScope: slot.slotScope,
    });
  }

  if (resolved === undefined) {
    leaveOut(tag, `${frame.component.name}: <${tag}> is not resolved`, state);
    return [];
  }
  if (frame.depth >= MAXIMUM_DEPTH) {
    leaveOut(
      tag,
      `<${tag}> is nested more than ${MAXIMUM_DEPTH} components deep and is not rendered`,
      state
    );
    return [];
  }
  const handWritten = isHandWritten(resolved) ? resolved : undefined;
  if (handWritten?.rendersAs === 'content') {
    return [behaviorBlock(tag, renderAtRest(projections, frame, state))];
  }
  const template = handWritten?.rendersAs ?? (resolved as Template);
  if (handWritten?.slots !== undefined) {
    routeSlots(projections, handWritten.slots);
  }

  const props: Record<string, unknown> = {};
  const output: OutputNode[] = [];
  // A function the component takes, such as an event callback, does nothing
  // at rest: one the markup cannot evaluate is left out without a warning,
  // where the prop's type holds nothing but functions (and `undefined` or
  // `null`); one that could be text still warns.
  const takesFunction = (name: string): boolean => {
    const type = Array.isArray(template)
      ? undefined
      : template.props?.[name]?.type;
    return type !== undefined && holdsOnlyFunctions(type);
  };
  for (const spread of nodeSpreads(node.attributes)) {
    try {
      Object.assign(props, spreadObject(evaluate(spread, scope, state)));
    } catch (error) {
      output.push(...dropUnresolved(error, frame, state));
    }
  }
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    if (name === '$spread' || value === undefined) {
      continue;
    }
    if (name === 'class') {
      props.class = classTokens(
        value as Attributes['class'],
        [],
        scope,
        state
      ).join(' ');
      continue;
    }
    if (isExpressionBinding(value)) {
      try {
        props[name] = evaluate(value.$expression, scope, state);
      } catch (error) {
        if (!(error instanceof Unresolved)) {
          throw error;
        }
        if (!takesFunction(name)) {
          output.push(...dropUnresolved(error, frame, state));
        }
        // A value read from a hand-written component's exposed value has
        // none at rest by design, as the value itself reads as nothing: the
        // prop is unset, so its default or a `?? fallback` applies. Any
        // other failure leaves the prop without a value, which an
        // expression naming it reports.
        props[name] = error.atRest
          ? undefined
          : new Unevaluated(`${name} has no value at rest`);
      }
      continue;
    }
    props[name] = value;
  }
  output.push(
    ...renderComponent(
      template,
      tag,
      props,
      projections,
      frame.depth + 1,
      state,
      new Set(handWritten?.props)
    )
  );
  return handWritten === undefined ? output : [behaviorBlock(tag, output)];
}

/** Moves each projection to the template slot a hand-written component fills. */
function routeSlots(
  projections: Map<string | undefined, Projection>,
  slots: Readonly<Record<string, string>>
): void {
  const slotName = (name: string) => (name === 'default' ? undefined : name);
  const moved = new Map<string | undefined, Projection>();
  for (const [from, to] of Object.entries(slots)) {
    const projection = projections.get(slotName(from));
    if (projection === undefined) {
      continue;
    }
    projections.delete(slotName(from));
    moved.set(slotName(to), projection);
  }
  for (const [name, projection] of moved) {
    projections.set(name, projection);
  }
}

function isHandWritten(
  resolved: Template | HandWrittenComponent
): resolved is HandWrittenComponent {
  return !Array.isArray(resolved) && 'rendersAs' in resolved;
}

/** The one comment a component written by hand leaves, around its markup. */
function behaviorBlock(tag: string, children: OutputNode[]): OutputNode {
  return {
    kind: 'block',
    open: `component: ${tag} (behavior not included)`,
    close: children.length === 0 ? undefined : '/component',
    children,
  };
}

/**
 * A hand-written component's content: the default slot's, then each named
 * slot's in the order passed.
 */
function renderAtRest(
  projections: ReadonlyMap<string | undefined, Projection>,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  const output: OutputNode[] = [];
  for (const [name, projection] of projections) {
    // The values the component would expose are unknown: each reads as
    // nothing, so its content renders in a resting state - closed, empty,
    // a placeholder showing through.
    const scope = new Map(projection.scope);
    for (const binding of projection.slotScope) {
      scope.set(binding, INERT);
    }
    const content =
      typeof projection.content === 'string'
        ? [{ kind: 'markup', markup: projection.content } as OutputNode]
        : renderNodes(projection.content, scope, frame, state);
    if (name === undefined) {
      output.unshift(...content);
    } else {
      output.push(...content);
    }
  }
  return output;
}

/** Records a component the markup leaves out, with a warning. */
function leaveOut(name: string, message: string, state: RenderState): void {
  if (!state.unresolved.includes(name)) {
    state.unresolved.push(name);
  }
  if (!state.warnings.some((warning) => warning.message === message)) {
    state.warnings.push({ message, kind: 'unresolved' });
  }
}

/** The consumer's extras routed to the routed element, or the root's rest. */
function extrasShare(frame: Frame, routed: boolean): Record<string, unknown> {
  if (frame.routed === undefined) {
    return routed ? {} : frame.extras;
  }
  const entries = frame.routed.entries;
  return Object.fromEntries(
    Object.entries(frame.extras).filter(
      ([name]) => isRoutedAttribute(entries, name) === routed
    )
  );
}

function renderElement(
  node: ElementNode,
  scope: Scope,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  const output: OutputNode[] = [];
  let tag = staticTagOf(node.tag);
  if (isDynamicTag(node.tag)) {
    try {
      const value = evaluate(node.tag.$expression, scope, state);
      if (typeof value === 'string' && /^[a-z][\w-]*$/.test(value)) {
        tag = value;
      } else if (value !== undefined && value !== null) {
        const expression = node.tag.$expression.trim();
        leaveOut(
          expression,
          `${frame.component.name}: the tag ${expression} is a component and is not rendered`,
          state
        );
        return [];
      }
    } catch (error) {
      output.push(...dropUnresolved(error, frame, state));
    }
  }

  // Spreads lead, so authored attributes override them per key; the
  // consumer's extras lead on the passthrough root, before any spread. The
  // consumer's style is the exception: it merges last, winning over the
  // node's own declarations, as in every scripted target - on the
  // passthrough root and on a node spreading the component's `rest`.
  const attributes = new Map<string, unknown>();
  const isRoutedElement =
    frame.routed !== undefined && node === frame.routed.node;
  const routedExtras = isRoutedElement ? extrasShare(frame, true) : {};
  const isPassthroughRoot =
    node.passthrough === true && frame.passthroughRoot === undefined;
  let consumerStyle: unknown;
  // The consumer's attributes an id list this element sets joins.
  let joinedExtras: Record<string, unknown> = {};
  // A routed element takes its share of the extras and the root the rest.
  if (isPassthroughRoot) {
    frame.passthroughRoot = node;
    const { style: extraStyle, ...extras } = extrasShare(frame, false);
    consumerStyle = extraStyle;
    joinedExtras = extras;
    assignSpread(attributes, extras);
  } else if (isRoutedElement) {
    joinedExtras = routedExtras;
    assignSpread(attributes, routedExtras);
  }
  for (const spread of nodeSpreads(node.attributes)) {
    try {
      const spreadAttributes = spreadObject(evaluate(spread, scope, state));
      if (spread === 'rest' && frame.component.rest !== undefined) {
        const { style: restStyle, ...restAttributes } = spreadAttributes;
        consumerStyle = [inlineStyle(consumerStyle), inlineStyle(restStyle)]
          .filter((part) => part !== '')
          .join('; ');
        assignSpread(attributes, restAttributes);
        continue;
      }
      assignSpread(attributes, spreadAttributes);
    } catch (error) {
      output.push(...dropUnresolved(error, frame, state));
    }
  }

  const conditionalClasses: string[] = [];
  for (const entry of node.conditionalAttributes ?? []) {
    let applies: boolean;
    try {
      applies = Boolean(evaluate(entry.condition, scope, state));
    } catch (error) {
      output.push(...dropUnresolved(error, frame, state));
      continue;
    }
    if (!applies) {
      continue;
    }
    for (const [name, value] of Object.entries(entry.attributes)) {
      if (name === 'class') {
        conditionalClasses.push(
          ...normalizeClassList(value as Attributes['class'])
        );
      } else if (isExpressionBinding(value)) {
        try {
          attributes.set(name, evaluate(value.$expression, scope, state));
        } catch (error) {
          output.push(...dropUnresolved(error, frame, state));
        }
      } else if (
        name !== 'style' &&
        name !== '$spread' &&
        value !== undefined
      ) {
        attributes.set(name, value);
      }
    }
  }

  const spreadClass = attributes.get('class');
  attributes.delete('class');
  const spreadStyle = attributes.get('style');
  attributes.delete('style');
  let style = inlineStyle(spreadStyle);
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    if (name === '$spread' || name === 'class' || value === undefined) {
      continue;
    }
    if (name === 'style') {
      const authored = styleDeclarations(
        value as NestedStyleObject,
        scope,
        state,
        frame,
        output
      );
      style = [style, authored].filter((part) => part !== '').join('; ');
      continue;
    }
    if (isExpressionBinding(value)) {
      try {
        const evaluated = evaluate(value.$expression, scope, state);
        // An authored value that resolves to nothing leaves a spread's in place.
        if (evaluated !== undefined && evaluated !== null) {
          attributes.set(name, evaluated);
        }
      } catch (error) {
        output.push(...dropUnresolved(error, frame, state));
      }
      continue;
    }
    attributes.set(name, value);
  }
  // An id list the passthrough root or the routed element sets itself keeps
  // its ids and gains the consumer's, as in every scripted target: the
  // tokens of both, each once, and no attribute when neither has one. A
  // list the consumer's value of that name does not reach (a declared prop,
  // or one routed to the other element) renders as authored.
  if (isPassthroughRoot || isRoutedElement) {
    const declared = declaredProps(frame.component);
    const authoredNames = new Set(
      [
        ...Object.entries(node.attributes ?? {}),
        ...(node.conditionalAttributes ?? []).flatMap((entry) =>
          Object.entries(entry.attributes)
        ),
      ]
        .filter(([, value]) => value !== undefined)
        .map(([name]) => name)
    );
    for (const name of authoredNames) {
      const reaches =
        isTokenListAttribute(name) &&
        !(name in declared) &&
        (frame.routed === undefined ||
          isRoutedAttribute(frame.routed.entries, name) === isRoutedElement);
      if (!reaches) continue;
      const joined = joinTokenLists(attributes.get(name), joinedExtras[name]);
      if (joined === undefined) {
        attributes.delete(name);
      } else {
        attributes.set(name, joined);
      }
    }
  }

  style = [style, inlineStyle(consumerStyle)]
    .filter((part) => part !== '')
    .join('; ');

  const classes = classTokens(
    node.attributes?.class,
    conditionalClasses,
    scope,
    state,
    frame,
    output
  );
  if (typeof spreadClass === 'string' && spreadClass.trim() !== '') {
    classes.push(...spreadClass.trim().split(/\s+/));
  }

  const formValue = takeFormValue(tag, attributes);

  const parts: string[] = [];
  const unique = [...new Set(classes)];
  if (unique.length > 0) {
    parts.push(`class=${quoteClassAttributeValue(unique.join(' '))}`);
  }
  for (const [name, value] of attributes) {
    // A DOM property with no attribute, such as an input's `indeterminate`,
    // is one markup cannot set.
    if (isPropertyOnlyName(name, tag)) {
      continue;
    }
    const part = attributePart(name, value);
    if (part !== undefined) {
      parts.push(part);
    }
  }
  if (style !== '') {
    parts.push(`style="${escapeAttributeValue(style)}"`);
  }
  const target = frame.plan.get(node);
  if (target?.generatedNodeValue !== undefined) {
    parts.push(`${GENERATED_NODE_ATTRIBUTE}="${target.generatedNodeValue}"`);
  }

  let children = renderNodes(node.children ?? [], scope, frame, state);
  if (formValue !== undefined && tag === 'select') {
    markSelected(children, selectedValues(formValue));
  } else if (formValue !== undefined && children.length === 0) {
    children = [{ kind: 'text', text: escapeText(textOf(formValue)) }];
  }
  output.push({ kind: 'element', tag, attributes: parts, children });
  return output;
}

/**
 * A form control's value as markup writes it, as a server render does:
 * `defaultValue` and `defaultChecked` are an input's `value` and `checked`,
 * an option's `defaultSelected` its `selected`,
 * and the value of a select or textarea is taken off its attributes and
 * returned, for the option it selects or the text it holds.
 */
function takeFormValue(tag: string, attributes: Map<string, unknown>): unknown {
  for (const [property, attribute] of [
    ['defaultChecked', 'checked'],
    ['defaultSelected', 'selected'],
  ]) {
    if (attributes.has(property)) {
      if (!attributes.has(attribute)) {
        attributes.set(attribute, attributes.get(property));
      }
      attributes.delete(property);
    }
  }
  let value = attributes.get('value') ?? attributes.get('defaultValue');
  attributes.delete('defaultValue');
  if (tag === 'select' || tag === 'textarea') {
    attributes.delete('value');
  } else if (value !== undefined && value !== null) {
    attributes.set('value', value);
    value = undefined;
  }
  return value === null ? undefined : value;
}

function selectedValues(value: unknown): Set<string> {
  const values = Array.isArray(value) ? value : [value];
  return new Set(values.map((entry) => escapeAttributeValue(textOf(entry))));
}

/** Marks each option whose value is among `values` as `selected`. */
function markSelected(nodes: OutputNode[], values: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === 'block') {
      markSelected(node.children, values);
    }
    if (node.kind !== 'element') {
      continue;
    }
    if (node.tag !== 'option') {
      markSelected(node.children, values);
      continue;
    }
    const attribute = node.attributes.find((part) =>
      part.startsWith('value="')
    );
    const optionValue =
      attribute === undefined
        ? node.children
            .map((child) => (child.kind === 'text' ? child.text : ''))
            .join('')
            .trim()
        : attribute.slice('value="'.length, -1);
    if (values.has(optionValue) && !node.attributes.includes('selected')) {
      node.attributes.push('selected');
    }
  }
}

/**
 * The class list in the order every target renders it: static and
 * extension classes, conditional classes, expression classes. Expression
 * values that fail to evaluate are written as a comment.
 */
function classTokens(
  value: Attributes['class'] | undefined,
  conditional: readonly string[],
  scope: Scope,
  state: RenderState,
  frame?: Frame,
  output?: OutputNode[]
): string[] {
  const tokens = [...normalizeClassList(value), ...conditional];
  for (const expression of classExpressions(value)) {
    try {
      tokens.push(...classValueTokens(evaluate(expression, scope, state)));
    } catch (error) {
      if (frame !== undefined && output !== undefined) {
        output.push(...dropUnresolved(error, frame, state));
      }
    }
  }
  return tokens;
}

function classValueTokens(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : value.trim().split(/\s+/);
  }
  if (Array.isArray(value)) {
    return value.flatMap(classValueTokens);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name);
  }
  return [];
}

/**
 * The inline declarations of an authored style: only the values computed
 * from expressions, since static styles live in the kit's stylesheet.
 */
function styleDeclarations(
  style: NestedStyleObject,
  scope: Scope,
  state: RenderState,
  frame: Frame,
  output: OutputNode[]
): string {
  const declarations: string[] = [];
  const whole = wholeStyleExpression(style);
  if (whole !== undefined) {
    try {
      const value = inlineStyle(evaluate(whole, scope, state));
      if (value !== '') {
        declarations.push(value);
      }
    } catch (error) {
      output.push(...dropUnresolved(error, frame, state));
    }
  }
  for (const [property, value] of Object.entries(style)) {
    if (property === '$expression' || !isExpressionBinding(value)) {
      continue;
    }
    try {
      const evaluated = evaluate(value.$expression, scope, state);
      if (evaluated !== undefined && evaluated !== null && evaluated !== '') {
        declarations.push(
          `${toKebabCaseProperty(property)}: ${String(evaluated)}`
        );
      }
    } catch (error) {
      output.push(...dropUnresolved(error, frame, state));
    }
  }
  return declarations.join('; ');
}

/** A style value from a spread or expression - an object or a string - as declarations. */
function inlineStyle(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  return Object.entries(value)
    .filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== ''
    )
    .map(
      ([property, entry]) =>
        `${toKebabCaseProperty(property)}: ${String(entry)}`
    )
    .join('; ');
}

/** Copies a spread object's attributes, leaving out handlers and handles. */
function assignSpread(
  attributes: Map<string, unknown>,
  spread: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(spread)) {
    if (typeof value === 'function' || /^on[A-Z]/.test(key)) {
      continue;
    }
    if (key === 'ref' || key === 'children' || key === 'key') {
      continue;
    }
    const name =
      key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key;
    if (value === undefined) {
      continue;
    }
    attributes.set(name, value);
  }
}

function spreadObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * One rendered attribute, as a browser would see the value React or Vue
 * sets: `true` is a bare boolean attribute (the string `"true"` on `aria-`
 * and `data-` attributes), `false`, `null` and `undefined` leave it out.
 */
function attributePart(name: string, value: unknown): string | undefined {
  const textual = /^(aria|data)-/.test(name);
  if (value === undefined || value === null || (value === false && !textual)) {
    return undefined;
  }
  if (value === true && !textual) {
    return name;
  }
  if (typeof value === 'object' || typeof value === 'function') {
    return undefined;
  }
  return `${name}="${escapeAttributeValue(String(value))}"`;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textOf).join('');
  }
  return '';
}

/**
 * Evaluates an expression against the scope. Throws {@link Unresolved} when
 * it does not parse as JavaScript or throws while it runs.
 */
function evaluate(
  expression: string,
  scope: Scope,
  state: RenderState
): unknown {
  const names = [...scope.keys()].filter((name) => IDENTIFIER.test(name));
  const mentions = (name: string): boolean =>
    new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(
      expression
    );
  // A name with no value at rest fails an expression that reads it free:
  // not one in a string, an object key, a member tail or a parameter.
  if (names.some((name) => scope.get(name) instanceof Unevaluated)) {
    const reads = freeNamesOf(expression, state);
    for (const name of names) {
      const value = scope.get(name);
      if (value instanceof Unevaluated && reads.has(name)) {
        throw new Unresolved(`${expression.trim()} (${value.reason})`);
      }
    }
  }
  // A value a slot exposes is worked out only when the expression names it.
  const read = (name: string): unknown => {
    const value = scope.get(name);
    if (value instanceof Unevaluated) return undefined;
    if (!(value instanceof Deferred)) return value;
    return mentions(name) ? value.read() : undefined;
  };
  // `as const` - the one piece of TypeScript expressions use, to type a
  // dynamic tag - is dropped; any other TypeScript fails to parse.
  const source = expression.replace(/\s+as\s+const\b/g, '');
  const key = `${names.join(',')}\n${source}`;
  let compiled = state.compiled.get(key);
  if (compiled === undefined) {
    try {
      compiled = new Function(
        ...names,
        `"use strict";\nreturn (${source}\n);`
      ) as (...values: unknown[]) => unknown;
    } catch (error) {
      throw new Unresolved(
        `${expression.trim()} (${error instanceof Error ? error.message : String(error)})`
      );
    }
    state.compiled.set(key, compiled);
  }
  try {
    return compiled(...names.map(read));
  } catch (error) {
    throw new Unresolved(
      `${expression.trim()} (${error instanceof Error ? error.message : String(error)})`,
      readsAtRestValue(expression, scope, state)
    );
  }
}

/**
 * Whether an expression reads, free, a value a hand-written component would
 * expose, which reads as {@link INERT} at rest.
 */
function readsAtRestValue(
  expression: string,
  scope: Scope,
  state: RenderState
): boolean {
  for (const name of freeNamesOf(expression, state)) {
    const value = scope.get(name);
    if (value === INERT) return true;
    if (value instanceof Deferred && value.read() === INERT) return true;
  }
  return false;
}

/** The names an expression reads free, worked out once per expression. */
function freeNamesOf(expression: string, state: RenderState): Set<string> {
  let names = state.freeNames.get(expression);
  if (names === undefined) {
    const tokens = flattenTemplateLiterals(tokenizeExpression(expression));
    names = new Set<string>();
    for (const [index, reading] of readExpressionIdentifiers(tokens)) {
      if (reading.free) {
        names.add(tokens[index].text);
      }
    }
    state.freeNames.set(expression, names);
  }
  return names;
}

/** Runs a render step, rendering nothing in its place when an expression fails. */
function attempt(
  state: RenderState,
  frame: Frame,
  render: () => OutputNode[]
): OutputNode[] {
  try {
    return render();
  } catch (error) {
    return dropUnresolved(error, frame, state);
  }
}

/**
 * What an expression that cannot be evaluated leaves: nothing in the markup,
 * where the comment would name a kit helper or a driver call, and a warning.
 */
function dropUnresolved(
  error: unknown,
  frame: Frame,
  state: RenderState
): OutputNode[] {
  warn(error, frame, state);
  return [];
}

function warn(error: unknown, frame: Frame, state: RenderState): void {
  if (!(error instanceof Unresolved)) {
    throw error;
  }
  if (error.atRest) {
    return;
  }
  const message = `${frame.component.name}: could not evaluate ${error.expression}`;
  if (!state.warnings.some((warning) => warning.message === message)) {
    state.warnings.push({ message, kind: 'unevaluated' });
  }
}
