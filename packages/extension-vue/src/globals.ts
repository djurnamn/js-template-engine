import {
  readExpressionIdentifiers,
  tokenizeExpression,
} from '@js-template-engine/core/emitter';

/**
 * The browser and JavaScript globals a Vue template reads through a setup
 * binding of the same name. Vue compiles a template expression against the
 * component instance, which sees only a short list of globals (`Math`,
 * `Date`, `JSON`, `console` and a few more); any other global, such as
 * `document`, reads `undefined` there. Each of these is the same object or
 * function for the life of the page, so `<script setup>` declares it once,
 * `const document = globalThis.document;`, and the template reads it as
 * written. Reading a property of `globalThis` never throws, so the
 * declaration is safe during server rendering, where it holds `undefined`
 * as the global does not exist. The window's functions are listed apart,
 * in {@link WINDOW_FUNCTIONS}.
 */
const STABLE_GLOBALS: ReadonlySet<string> = new Set([
  // The window and its objects.
  'window',
  'self',
  'document',
  'navigator',
  'location',
  'history',
  'screen',
  'localStorage',
  'sessionStorage',
  'performance',
  'crypto',
  'customElements',
  'visualViewport',
  'indexedDB',
  'caches',
  'CSS',
]);

/**
 * The window's functions, which throw `Illegal invocation` when called with
 * any `this` but the window. Vue's development build calls a setup binding
 * the template reads as a method of the setup state (`$setup.setTimeout(...)`),
 * so each is declared bound to the global, and `undefined` where the global
 * does not exist: `const setTimeout = globalThis.setTimeout?.bind(globalThis);`.
 */
const WINDOW_FUNCTIONS: ReadonlySet<string> = new Set([
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'queueMicrotask',
  'structuredClone',
  'fetch',
  'alert',
  'confirm',
  'prompt',
  'getComputedStyle',
  'getSelection',
  'matchMedia',
  'scrollTo',
  'scrollBy',
  'atob',
  'btoa',
  'reportError',
  'print',
  'postMessage',
]);

/** Built-in objects the template reads by their own name. */
const BUILT_IN_GLOBALS: ReadonlySet<string> = new Set([
  // Built-in constructors and namespaces outside Vue's list.
  'Promise',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'Proxy',
  'Reflect',
  'ArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'AggregateError',
  'URL',
  'URLSearchParams',
  'FormData',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'Blob',
  'File',
  'FileReader',
  'TextEncoder',
  'TextDecoder',
  'DOMParser',
  'DOMRect',
  'Event',
  'EventTarget',
  'Node',
  'Element',
  'IntersectionObserver',
  'ResizeObserver',
  'MutationObserver',
  'BroadcastChannel',
  'Document',
  'Window',
  'ShadowRoot',
  'DocumentFragment',
  'Text',
  'Range',
  'Image',
  'WebSocket',
  'Worker',
  'Notification',
]);

/**
 * Element interfaces (`HTMLInputElement`, `SVGElement`) and event
 * constructors (`CustomEvent`, `KeyboardEvent`), read in an `instanceof`
 * check or a `new` expression.
 */
const STABLE_GLOBAL_PATTERN =
  /^(?:(?:HTML|SVG)[A-Za-z]*Element|[A-Z][A-Za-z]*Event)$/;

/**
 * The browser globals that change as the page does (`scrollY`,
 * `innerWidth`), which a setup binding would read only once, and
 * `globalThis`, which cannot be declared under its own name. A Vue template
 * reading one bare is reported instead, with the form that works:
 * `window.scrollY`.
 */
const LIVE_GLOBALS: ReadonlySet<string> = new Set([
  'globalThis',
  'innerWidth',
  'innerHeight',
  'outerWidth',
  'outerHeight',
  'scrollX',
  'scrollY',
  'pageXOffset',
  'pageYOffset',
  'screenX',
  'screenY',
  'screenLeft',
  'screenTop',
  'devicePixelRatio',
  'isSecureContext',
  'crossOriginIsolated',
]);

/** The browser globals a Vue template reads, by how the output handles them. */
export interface TemplateGlobals {
  /** The globals `<script setup>` declares for the template, in first-read order. */
  declared: string[];
  /** The globals a setup binding cannot carry, in first-read order. */
  reported: string[];
}

/**
 * The browser globals a Vue template's expressions read, as free
 * references the component does not bind itself. A name the component
 * declares - a prop, a name its script or an import binds at the top level,
 * or a two-way value - is not a global, nor is a template local such as an
 * iteration's `item` in an expression bound where it is in scope, nor is a name an expression binds itself (a handler's
 * parameter), a member-access tail or an object key. A name after `as` or
 * `satisfies` is a type. A name outside the known globals is left alone: it
 * may be one of the application's global properties.
 *
 * @param expressions - The expressions the template binds, as written,
 *   each with the template locals in scope where it is bound.
 * @param bound - Every name the component binds in the template's scope.
 * @returns The globals the setup declares, and those it reports.
 * @example
 * templateGlobals(['() => document.body.focus()', 'scrollY > 0'], new Set());
 * // { declared: ['document'], reported: ['scrollY'] }
 */
export function templateGlobals(
  expressions: ReadonlyArray<
    string | { expression: string; locals: ReadonlySet<string> }
  >,
  bound: ReadonlySet<string>
): TemplateGlobals {
  const read = new Set<string>();
  for (const entry of expressions) {
    const { expression, locals } =
      typeof entry === 'string'
        ? { expression: entry, locals: new Set() }
        : entry;
    for (const name of freeNames(expression)) {
      if (!locals.has(name)) {
        read.add(name);
      }
    }
  }
  const globals = [...read].filter((name) => !bound.has(name));
  return {
    declared: globals.filter(
      (name) =>
        STABLE_GLOBALS.has(name) ||
        WINDOW_FUNCTIONS.has(name) ||
        BUILT_IN_GLOBALS.has(name) ||
        STABLE_GLOBAL_PATTERN.test(name)
    ),
    reported: globals.filter((name) => LIVE_GLOBALS.has(name)),
  };
}

/**
 * The declaration `<script setup>` makes for a global the template reads.
 *
 * @param name - The global's name.
 * @returns The declaration: `const document = globalThis.document;`, and for
 *   a window function `const setTimeout = globalThis.setTimeout?.bind(globalThis);`.
 */
export function globalDeclaration(name: string): string {
  return WINDOW_FUNCTIONS.has(name)
    ? `const ${name} = globalThis.${name}?.bind(globalThis);`
    : `const ${name} = globalThis.${name};`;
}

/** The tokens that end a type written after `as` or `satisfies`, at its own depth. */
const TYPE_ENDINGS = new Set([
  ')',
  ']',
  '}',
  ',',
  ';',
  '=',
  '&&',
  '||',
  '??',
  '?',
  ':',
]);

/**
 * The free names an expression reads, the expressions inside its template
 * literals' `${...}` placeholders included, leaving out the names of a type
 * written after `as` or `satisfies` (`event.target as HTMLInputElement |
 * HTMLTextAreaElement`), which run to the token that closes the expression
 * the type sits in.
 */
function freeNames(expression: string): string[] {
  const tokens = tokenizeExpression(expression);
  const readings = readExpressionIdentifiers(tokens);
  const names: string[] = [];
  let typeDepth: number | undefined;
  tokens.forEach((token, index) => {
    if (token.kind === 'space') {
      return;
    }
    if (typeDepth !== undefined) {
      if (['(', '[', '{', '<'].includes(token.text)) {
        typeDepth += 1;
        return;
      }
      if (typeDepth > 0 && [')', ']', '}', '>'].includes(token.text)) {
        typeDepth -= 1;
        return;
      }
      if (typeDepth > 0 || !TYPE_ENDINGS.has(token.text)) {
        return;
      }
      typeDepth = undefined;
    }
    if (token.text === 'as' || token.text === 'satisfies') {
      typeDepth = 0;
      return;
    }
    if (readings.get(index)?.free === true) {
      names.push(token.text);
    }
    if (token.kind === 'string' && token.text.startsWith('`')) {
      for (const placeholder of templatePlaceholders(token.text)) {
        names.push(...freeNames(placeholder));
      }
    }
  });
  return names;
}

/** The expressions of a template literal's `${...}` placeholders. */
function templatePlaceholders(literal: string): string[] {
  const placeholders: string[] = [];
  let index = 0;
  while (index < literal.length) {
    if (literal[index] === '\\') {
      index += 2;
      continue;
    }
    if (literal.startsWith('${', index)) {
      let depth = 1;
      const start = index + 2;
      let end = start;
      for (; end < literal.length && depth > 0; end += 1) {
        if (literal[end] === '{') depth += 1;
        if (literal[end] === '}') depth -= 1;
      }
      placeholders.push(literal.slice(start, end - 1));
      index = end;
      continue;
    }
    index += 1;
  }
  return placeholders;
}
