import { topLevelDeclarations, tokenizeExpression } from '../expression-scope';
import { partitionImports } from '../import-statements';

/**
 * The module-scope values a component's `imports` lines declare, worked out
 * at build time for an instance render.
 */
export interface ModuleScope {
  /** Each name a declaration that ran binds, with its value. */
  values: Map<string, unknown>;
  /** Each name a declaration that could not run binds, with the reason. */
  failures: Map<string, string>;
}

/** The part of the TypeScript compiler a declaration's types are erased with. */
interface TypeScriptCompiler {
  transpileModule(
    input: string,
    options: {
      compilerOptions: Record<string, unknown>;
      fileName?: string;
      reportDiagnostics?: boolean;
    }
  ): {
    outputText: string;
    diagnostics?: ReadonlyArray<{
      messageText: string | { messageText: string };
      start?: number;
    }>;
  };
  ScriptTarget: { ES2022: number };
  ModuleKind: { ESNext: number };
  JsxEmit?: { Preserve: number };
}

/** The TypeScript compiler, once looked for: `null` when it could not be loaded. */
let typeScript: TypeScriptCompiler | null | undefined;

/** What the loader needs of Node's `process`, where there is one. */
interface NodeProcess {
  cwd(): string;
  getBuiltinModule?(id: string): unknown;
}

/**
 * The TypeScript compiler, from beside this package or else from the working
 * directory's project, or `null` when neither has it or there is no Node.js
 * to load it with, as in a browser. It is loaded through Node's own module
 * API at run time, which a bundler does not follow, so a bundle of this
 * package never takes the compiler in.
 */
function loadTypeScript(): TypeScriptCompiler | null {
  if (typeScript !== undefined) {
    return typeScript;
  }
  typeScript = null;
  try {
    if (typeof process === 'undefined') {
      return typeScript;
    }
    const nodeProcess = process as unknown as NodeProcess;
    // Node's module API, through `process` where Node.js offers it, else
    // through the CommonJS module's own `require`.
    const moduleApi = (nodeProcess.getBuiltinModule?.('node:module') ??
      (typeof module !== 'undefined' && typeof module.require === 'function'
        ? module.require('node:module')
        : undefined)) as
      | { createRequire(path: string): (id: string) => unknown }
      | undefined;
    if (moduleApi === undefined) {
      return typeScript;
    }
    const bases = [
      typeof __filename === 'string' ? __filename : undefined,
      `${nodeProcess.cwd()}/package.json`,
    ];
    for (const base of bases) {
      if (base === undefined) continue;
      try {
        const loaded = moduleApi.createRequire(base)(
          'typescript'
        ) as TypeScriptCompiler;
        if (typeof loaded?.transpileModule === 'function') {
          typeScript = loaded;
          break;
        }
      } catch {
        // Not installed where this base resolves from.
      }
    }
  } catch {
    // No module API to load it with.
  }
  return typeScript;
}

/**
 * A declaration chunk with its `export` modifiers dropped (`export const`,
 * `export function`, `export default function`), or `undefined` for one that
 * binds no value of its own: a re-export or an export list.
 */
function withoutExports(chunk: string): string | undefined {
  const tokens = tokenizeExpression(chunk);
  const significant = (from: number, step: number): number => {
    let index = from + step;
    while (tokens[index]?.kind === 'space') {
      index += step;
    }
    return index;
  };
  let text = '';
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const before = tokens[significant(index, -1)];
    const startsStatement =
      before === undefined ||
      before.text === ';' ||
      before.text === '}' ||
      /\n/.test(
        tokens
          .slice(significant(index, -1) + 1, index)
          .map((each) => each.text)
          .join('')
      );
    if (token.text === 'export' && startsStatement) {
      const next = tokens[significant(index, 1)];
      if (next?.text === '{' || next?.text === '*' || next?.text === 'type') {
        const after = tokens[significant(significant(index, 1), 1)];
        if (
          next.text !== 'type' ||
          after?.text === '{' ||
          after?.text === '*'
        ) {
          return undefined;
        }
      }
      // The modifier and the space after it go; so does `default` before a
      // function or class.
      index = significant(index, 1) - 1;
      const following = tokens[index + 1];
      if (following?.text === 'default') {
        index = significant(index + 1, 1) - 1;
      }
      continue;
    }
    text += token.text;
  }
  return text;
}

/**
 * Why an `imports` entry does not parse as a TypeScript module, with the
 * line of the entry the parser stopped at, or `undefined` when it parses.
 * An entry parses when it parses as TypeScript or as TSX, since one is
 * written into a React component file and the other targets' scripts. Only
 * the syntax is checked, never types or names; without the TypeScript
 * compiler, which is an optional peer, nothing is checked and every entry
 * passes.
 *
 * @param entry - One `imports` entry.
 * @returns The parser's first message and its line, or `undefined`.
 *
 * @example
 * importsEntryParseFailure('function f(text: string) {\n  //');
 * // "'}' expected (line 2)"
 */
export function importsEntryParseFailure(entry: string): string | undefined {
  const compiler = loadTypeScript();
  if (compiler === null) {
    return undefined;
  }
  const diagnose = (fileName: string) =>
    compiler.transpileModule(entry, {
      fileName,
      compilerOptions: {
        target: compiler.ScriptTarget.ES2022,
        module: compiler.ModuleKind.ESNext,
        isolatedModules: true,
        ...(compiler.JsxEmit === undefined
          ? {}
          : { jsx: compiler.JsxEmit.Preserve }),
      },
      reportDiagnostics: true,
    }).diagnostics?.[0];
  const failure = diagnose('imports-entry.ts');
  if (failure === undefined || diagnose('imports-entry.tsx') === undefined) {
    return undefined;
  }
  const message = (
    typeof failure.messageText === 'string'
      ? failure.messageText
      : failure.messageText.messageText
  ).replace(/\.$/, '');
  const line = entry
    .slice(0, Math.min(failure.start ?? 0, entry.length))
    .split('\n').length;
  return `${message} (line ${line})`;
}

/** Whether a source parses as the body of a strict-mode function. */
function parses(source: string): string | undefined {
  try {
    new Function(`"use strict";\n${source}`);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The most declaration chunks {@link converted} keeps. */
const CONVERTED_LIMIT = 500;

/**
 * The declaration chunks converted lately, by their source, the least
 * recently used first.
 */
const converted = new Map<string, { source: string } | { reason: string }>();

/** A declaration chunk as JavaScript, or the reason it cannot be. */
function toJavaScript(chunk: string): { source: string } | { reason: string } {
  let result = converted.get(chunk);
  if (result === undefined) {
    result = convert(chunk);
  } else {
    converted.delete(chunk);
  }
  converted.set(chunk, result);
  if (converted.size > CONVERTED_LIMIT) {
    converted.delete(converted.keys().next().value as string);
  }
  return result;
}

function convert(chunk: string): { source: string } | { reason: string } {
  const compiler = loadTypeScript();
  if (compiler === null) {
    const failure = parses(chunk);
    return failure === undefined
      ? { source: chunk }
      : {
          reason: `it does not parse as JavaScript (${failure}), and the typescript package, which would strip its types, could not be loaded`,
        };
  }
  const { outputText, diagnostics } = compiler.transpileModule(chunk, {
    compilerOptions: {
      target: compiler.ScriptTarget.ES2022,
      module: compiler.ModuleKind.ESNext,
      isolatedModules: true,
      verbatimModuleSyntax: false,
    },
    reportDiagnostics: true,
  });
  if (diagnostics !== undefined && diagnostics.length > 0) {
    const message = diagnostics[0].messageText;
    return {
      reason: `it does not parse (${typeof message === 'string' ? message : message.messageText})`,
    };
  }
  // An emptied module keeps a marker export, which binds nothing.
  const source = outputText.replace(/^\s*export\s*\{\s*\};?\s*$/gm, '');
  const failure = parses(source);
  return failure === undefined
    ? { source }
    : { reason: `it does not run as JavaScript (${failure})` };
}

/** One declaration chunk ready to run, with the names it binds. */
interface Unit {
  source: string;
  names: string[];
}

/**
 * Runs one unit against the shared module environment and returns the
 * values it binds, in the order of its names. Throws what the unit throws.
 * The unit runs as strict code inside a `with` over the environment, so a
 * name it reads resolves, when it is read, to a value the outside or any
 * declaration has put there - a function calling one declared on a later
 * line included - and otherwise to a global. What a unit binds is copied
 * into the environment once the unit has run, a snapshot: a later change to
 * a binding inside its chunk, or an assignment from another chunk, does not
 * reach the other chunks, and of two chunks declaring one name the last one
 * wins.
 */
function runUnit(unit: Unit, environment: Record<string, unknown>): unknown[] {
  const body = `with (environment) {\nreturn (function () {\n"use strict";\n${unit.source}\n;\nreturn [${unit.names.join(', ')}];\n})();\n}`;
  return new Function('environment', body)(environment) as unknown[];
}

/**
 * Evaluates the declarations on a component's `imports` lines - its
 * functions, constants and other module-scope values, not its import
 * statements - so an instance render's expressions can call a helper
 * declared there. Their TypeScript types are erased with the TypeScript
 * compiler, where it is installed; without it, only a declaration that
 * parses as JavaScript runs. Each declaration chunk - an `imports` entry, or
 * the part of one between import statements - runs once, in order, any
 * statement written beside its declarations included; a chunk declaring
 * nothing does not run. A chunk reads the outside values (the instance's
 * `scope`) and what the chunks before it bind, and a function it declares
 * also reads what later chunks bind, once they have run. A chunk that does
 * not parse or throws, such as a context created through an imported
 * function, binds nothing; its names are reported with the reason, and the
 * chunks after it still run.
 *
 * @param lines - The component's `imports` lines.
 * @param outside - The values every expression can read, under their names.
 * @returns The values the declarations bind and the names that failed.
 *
 * @example
 * evaluateModuleDeclarations(
 *   ['function pick(items: string[], count: number): string[] { return items.slice(0, count); }'],
 *   new Map()
 * ).values.get('pick');
 * // [Function: pick]
 */
export function evaluateModuleDeclarations(
  lines: readonly string[],
  outside: ReadonlyMap<string, unknown>
): ModuleScope {
  const failures = new Map<string, string>();
  const units: Unit[] = [];
  for (const chunk of partitionImports(lines).declarations) {
    const declaration = withoutExports(chunk);
    if (declaration === undefined || declaration.trim() === '') {
      continue;
    }
    const javaScript = toJavaScript(declaration);
    if ('reason' in javaScript) {
      for (const name of topLevelDeclarations(declaration)) {
        failures.set(name, javaScript.reason);
      }
      continue;
    }
    const names = [...topLevelDeclarations(javaScript.source)];
    if (names.length > 0) {
      units.push({ source: javaScript.source, names });
    }
  }
  // One environment the units share, the outside values first: each unit
  // runs once, in order, and puts what it binds there for the rest.
  const environment: Record<string, unknown> = Object.create(null);
  for (const [name, value] of outside) {
    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
      environment[name] = value;
    }
  }
  const values = new Map<string, unknown>();
  for (const unit of units) {
    let bound: unknown[];
    try {
      bound = runUnit(unit, environment);
    } catch (error) {
      const reason = `it throws (${error instanceof Error ? error.message : String(error)})`;
      for (const name of unit.names) {
        failures.set(name, reason);
      }
      continue;
    }
    unit.names.forEach((name, index) => {
      environment[name] = bound[index];
      values.set(name, bound[index]);
      failures.delete(name);
    });
  }
  return { values, failures };
}
