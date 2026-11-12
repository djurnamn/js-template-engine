import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  handlerCallStatement,
  invokeHandlerDeclaration,
  usesInvokeHandler,
} from '../src/handler-call';

describe('handlerCallStatement', () => {
  it('passes the event to a name or member path through invokeHandler', () => {
    expect(handlerCallStatement('save')).toBe('invokeHandler(save, event);');
    expect(handlerCallStatement('handlers.save')).toBe(
      'invokeHandler(handlers.save?.bind(handlers), event);'
    );
  });

  it('calls an expression that may yield no handler through invokeHandler', () => {
    expect(handlerCallStatement('onSave ? save : undefined')).toBe(
      'invokeHandler((onSave ? save : undefined), event);'
    );
  });

  it('passes the event to an expression that may declare it', () => {
    expect(handlerCallStatement('(event) => save(event)')).toBe(
      '((event) => save(event))(event);'
    );
    expect(handlerCallStatement('event => save(event)')).toBe(
      '(event => save(event))(event);'
    );
    expect(handlerCallStatement('function (event) { save(event); }')).toBe(
      '(function (event) { save(event); })(event);'
    );
    expect(handlerCallStatement('functionFor(1)')).toBe(
      'invokeHandler((functionFor(1)), event);'
    );
  });

  it('trims the handler', () => {
    expect(handlerCallStatement('  save \n')).toBe('invokeHandler(save, event);');
    expect(handlerCallStatement(' () => save() ')).toBe('(() => save())();');
  });

  it('reads a typed parameterless arrow as parameterless', () => {
    expect(handlerCallStatement('(): void => choose(1)')).toBe(
      '((): void => choose(1))();'
    );
    expect(
      handlerCallStatement('async (): Promise<void> => { await save(); }')
    ).toBe('(async (): Promise<void> => { await save(); })();');
    expect(handlerCallStatement('(event: Event): void => save(event)')).toBe(
      '((event: Event): void => save(event))(event);'
    );
  });

  it('calls a function literal that declares no parameters without the event', () => {
    expect(handlerCallStatement('() => choose(1)')).toBe(
      '(() => choose(1))();'
    );
    expect(handlerCallStatement('async ( ) => { await save(); }')).toBe(
      '(async ( ) => { await save(); })();'
    );
    expect(handlerCallStatement('function () { save(); }')).toBe(
      '(function () { save(); })();'
    );
    expect(handlerCallStatement('async function named() {}')).toBe(
      '(async function named() {})();'
    );
  });
});

describe('invokeHandlerDeclaration', () => {
  it('types the arguments from the listener, so a shorter handler checks', () => {
    const source = [
      invokeHandlerDeclaration(),
      'declare const confirm: (() => void) | undefined;',
      'declare const submit: ((event: { key: string }) => void) | undefined;',
      'declare const wrong: ((event: { code: number }) => void) | undefined;',
      'export function listen(event: KeyboardEvent): void {',
      '  invokeHandler(confirm, event);',
      '  invokeHandler(submit, event);',
      '  // @ts-expect-error the handler wants what the listener lacks',
      '  invokeHandler(wrong, event);',
      '}',
    ].join('\n');
    const host = ts.createCompilerHost({ strict: true, noEmit: true });
    const original = host.getSourceFile;
    host.getSourceFile = (name, language) =>
      name === 'probe.ts'
        ? ts.createSourceFile(name, source, language)
        : original(name, language);
    const program = ts.createProgram(
      ['probe.ts'],
      { strict: true, noEmit: true, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] },
      host
    );
    expect(
      ts.getPreEmitDiagnostics(program).map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      )
    ).toEqual([]);
  });
});

describe('a member path called through invokeHandler', () => {
  it("keeps the method's receiver", () => {
    const statement = handlerCallStatement('handlers.save');
    expect(statement).toBe(
      'invokeHandler(handlers.save?.bind(handlers), event);'
    );
    const javascript = ts.transpileModule(
      `${invokeHandlerDeclaration()}\nreturn (handlers: unknown, event: unknown) => { ${statement} };`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
    ).outputText;
    const run = new Function(javascript)() as (
      handlers: unknown,
      event: unknown
    ) => void;
    const saved: unknown[] = [];
    const handlers = {
      name: 'form',
      save(event: unknown) {
        saved.push([this.name, event]);
      },
    };
    run(handlers, 'submit');
    run({ name: 'empty' }, 'submit');
    expect(saved).toEqual([['form', 'submit']]);
  });
});

describe('usesInvokeHandler', () => {
  it('matches a call of the helper, not a name that ends in it', () => {
    expect(usesInvokeHandler('{ invokeHandler(save, event); }')).toBe(true);
    expect(usesInvokeHandler('reinvokeHandler(save)')).toBe(false);
    expect(usesInvokeHandler('api.invokeHandler(save)')).toBe(false);
  });
});
