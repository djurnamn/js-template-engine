import type {
  ElementNode,
  EventDefinition,
  Warning,
} from '@js-template-engine/types';

import {
  isKeyEventModifier,
  keyGuardStatement,
} from '../key-event-modifiers';
import type { NormalizedComponent } from '../normalize';
import { visitElements } from '../traverse';
import type { TargetPlan } from './targeting';

/** Matches an identifier or a dot-separated member path: `handlers.save`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

const LISTENER_OPTION_MODIFIERS = ['capture', 'once', 'passive'] as const;

/**
 * Builds the component's script block: prop defaults as consts, the
 * component script content, and `addEventListener` wiring (under the
 * `in-file` and `separate-file` scripting strategies). Returns an empty
 * string when there is nothing to emit.
 *
 * Under `scripting.language: 'typescript'` the generated prop-default consts
 * carry their declared prop type (a TypeScript type expression); the
 * component `script` content and event wiring emit verbatim either way - the
 * engine performs no TypeScript transformation of author code.
 *
 * Component import statements are not included - a plain script block has
 * no module scope - and produce a warning instead.
 */
export function buildScript(
  component: NormalizedComponent,
  plan: TargetPlan,
  scriptingStrategy: string,
  scriptLanguage: 'javascript' | 'typescript',
  warnings: Warning[]
): string {
  const sections: string[] = [];

  if (component.imports.length > 0) {
    warnings.push({
      message: 'Import statements are not included in HTML output',
      nodePath: 'imports',
    });
  }

  const typed = scriptLanguage === 'typescript';
  const constants = Object.entries(component.props)
    .filter(([, prop]) => prop.default !== undefined)
    .map(([name, prop]) => {
      const annotation = typed ? `: ${prop.type}` : '';
      return `const ${name}${annotation} = ${JSON.stringify(prop.default)};`;
    });
  if (constants.length > 0) {
    sections.push(constants.join('\n'));
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(component.script.trim());
  }

  if (scriptingStrategy !== 'inline') {
    const wiring: string[] = [];
    visitElements(component.children, (element) => {
      wiring.push(...listenerStatements(element, plan));
    });
    if (wiring.length > 0) {
      sections.push(wiring.join('\n'));
    }
  }

  return sections.join('\n\n');
}

function listenerStatements(element: ElementNode, plan: TargetPlan): string[] {
  const events = element.events ?? [];
  if (events.length === 0) {
    return [];
  }
  const target = plan.get(element);
  if (!target) {
    return [];
  }
  const selector = `document.querySelector('${target.selector}')`;
  return events.map((event) => listenerStatement(selector, event));
}

function listenerStatement(selector: string, event: EventDefinition): string {
  const guards = guardStatements(event);
  const options = listenerOptions(event);
  const optionsSuffix = options === '' ? '' : `, ${options}`;

  if (guards.length === 0) {
    return `${selector}.addEventListener('${event.name}', ${event.handler}${optionsSuffix});`;
  }

  const call = IDENTIFIER_PATH.test(event.handler)
    ? `${event.handler}(event);`
    : `(${event.handler})(event);`;
  const body = [...guards, call].map((line) => `  ${line}`).join('\n');
  return `${selector}.addEventListener('${event.name}', function (event) {\n${body}\n}${optionsSuffix});`;
}

/**
 * Builds an inline event handler attribute (`onclick="..."`) for the
 * `inline` scripting strategy.
 *
 * The `once` modifier disarms the handler by clearing the attribute-bound
 * property; `capture` and `passive` cannot be expressed in inline handlers
 * and produce a warning.
 */
export function inlineHandlerAttribute(
  event: EventDefinition,
  nodePath: string,
  warnings: Warning[]
): { name: string; value: string } {
  const statements: string[] = [];

  if (event.modifiers?.includes('once')) {
    statements.push(`this.on${event.name} = null;`);
  }
  for (const modifier of event.modifiers ?? []) {
    if (modifier === 'capture' || modifier === 'passive') {
      warnings.push({
        message: `The '${modifier}' modifier cannot be applied with inline event handlers`,
        nodePath,
      });
    }
  }
  statements.push(...guardStatements(event));

  const call = IDENTIFIER_PATH.test(event.handler)
    ? `${event.handler}(event)`
    : `(${event.handler})(event)`;
  statements.push(call);

  return { name: `on${event.name}`, value: statements.join(' ') };
}

/**
 * Guard statements for the `self`, `prevent`, and `stop` modifiers and the
 * key-guard modifiers, in declared order.
 */
function guardStatements(event: EventDefinition): string[] {
  const guards: string[] = [];
  for (const modifier of event.modifiers ?? []) {
    if (modifier === 'self') {
      guards.push('if (event.target !== event.currentTarget) return;');
    } else if (modifier === 'prevent') {
      guards.push('event.preventDefault();');
    } else if (modifier === 'stop') {
      guards.push('event.stopPropagation();');
    } else if (isKeyEventModifier(modifier)) {
      guards.push(keyGuardStatement(modifier));
    }
  }
  return guards;
}

function listenerOptions(event: EventDefinition): string {
  const present = LISTENER_OPTION_MODIFIERS.filter((option) =>
    event.modifiers?.includes(option)
  );
  if (present.length === 0) {
    return '';
  }
  return `{ ${present.map((option) => `${option}: true`).join(', ')} }`;
}
