/** Matches an identifier or a dot-separated member path: `handlers.save`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * Matches the start of a function literal that declares no parameters:
 * `() => ...`, `async () => ...`, `(): void => ...`, `function () { ... }`.
 * An expression that opens with an arrow is that arrow as a whole, since an
 * arrow's body runs to the end of the expression.
 */
const PARAMETERLESS_FUNCTION =
  /^(?:(?:async\s*)?\(\s*\)\s*(?::[^=]*?)?=>|(?:async\s+)?function\b\s*\*?\s*(?:[A-Za-z_$][\w$]*)?\s*\(\s*\))/;

/**
 * Matches the start of a function literal that declares parameters:
 * `(event) => ...`, `event => ...`, `async (event: Event): void => ...`,
 * `function (event) { ... }`.
 */
const FUNCTION_LITERAL =
  /^(?:(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]*?)?=>|(?:async\s+)?function\b)/;

/** The name of the generated helper a wrapper calls a handler through. */
export const INVOKE_HANDLER = 'invokeHandler';

/**
 * The generated helper a scripted target declares where a wrapper calls a
 * handler it does not see: it calls the handler with the listener's
 * arguments when it is set, and does nothing otherwise. The arguments are
 * inferred from the listener alone, so a handler declaring fewer of them
 * (`() => void`) type-checks, as it does bound directly.
 *
 * @returns The TypeScript function declaration.
 * @example
 * // (event) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); }
 */
export function invokeHandlerDeclaration(): string {
  return [
    `function ${INVOKE_HANDLER}<Arguments extends unknown[]>(`,
    '  handler:',
    '    | ((...args: [Arguments][Arguments extends unknown ? 0 : never]) => unknown)',
    '    | undefined',
    '    | null,',
    '  ...args: Arguments',
    '): void {',
    "  if (typeof handler === 'function') {",
    '    handler(...args);',
    '  }',
    '}',
  ].join('\n');
}

/**
 * Whether generated code calls the {@link invokeHandlerDeclaration} helper,
 * so the component declares it. The name is reserved, so no authored code
 * calls it.
 *
 * @param code - The generated markup or script.
 * @returns Whether it calls `invokeHandler`.
 */
export function usesInvokeHandler(code: string): boolean {
  return new RegExp(`(?<![\\w$.])${INVOKE_HANDLER}\\(`).test(code);
}

/**
 * A handler named by a path as the generated helper receives it: a bare
 * name as it is, a member path bound to its object, `handlers.save?.bind(
 * handlers)`, so a method reading `this` keeps its receiver, as a direct
 * call `handlers.save(event)` would give it. Binding an unset method yields
 * `undefined`, which the helper skips.
 *
 * @param path - A name or member path.
 * @returns The handler expression.
 * @example
 * boundHandler('save'); // 'save'
 * boundHandler('handlers.save'); // 'handlers.save?.bind(handlers)'
 */
export function boundHandler(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? path : `${path}?.bind(${path.slice(0, dot)})`;
}

/**
 * The statement a generated event wrapper uses to call an authored handler
 * with the event. A function literal is called as it is,
 * `((value) => save(value))(event);`; a function literal that declares no
 * parameters is called without the event, `(() => choose(1))();`, so the
 * call type-checks under a strict compiler, which rejects an argument the
 * function does not declare. Any other expression - a name, a member path,
 * a call or a conditional - may yield no handler (an unset optional prop)
 * or a handler declaring fewer parameters than the listener passes, so it is
 * called through the generated helper, `invokeHandler(save, event);`, which
 * does nothing for an unset one and types the arguments from the listener.
 *
 * @param handler - The authored handler expression.
 * @returns The call statement, ending in a semicolon.
 *
 * @example
 * handlerCallStatement('save'); // 'invokeHandler(save, event);'
 * handlerCallStatement('handlers.save'); // 'invokeHandler(handlers.save?.bind(handlers), event);'
 * handlerCallStatement('() => choose(1)'); // '(() => choose(1))();'
 */
export function handlerCallStatement(handler: string): string {
  const trimmed = handler.trim();
  if (IDENTIFIER_PATH.test(trimmed)) {
    return `${INVOKE_HANDLER}(${boundHandler(trimmed)}, event);`;
  }
  if (PARAMETERLESS_FUNCTION.test(trimmed)) {
    return `(${trimmed})();`;
  }
  if (FUNCTION_LITERAL.test(trimmed)) {
    return `(${trimmed})(event);`;
  }
  return `${INVOKE_HANDLER}((${trimmed}), event);`;
}
