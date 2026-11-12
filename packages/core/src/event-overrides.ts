import type { EventDefinition, Warning } from '@js-template-engine/types';

import { staticTagOf } from './dynamic-tag';
import type { NormalizedComponent } from './normalize';
import { visitNodes } from './traverse';

/**
 * Warns about each element whose `events` override for the framework being
 * built leaves out events the element declares. The override replaces the
 * node's whole event list, so an event it does not repeat is not handled in
 * that target, which is easy to miss when the override is there to swap one
 * event (`change` in React for a controlled input's `input`). An override
 * event replaces a left-out event, and so does not warn, when it is of
 * another name and either takes the left-out event's handler or is `change`
 * standing in for `input` (the controlled-input swap, whatever its handler
 * reads); each override event replaces at most one. An empty list, which
 * drops the events on purpose, does not warn.
 *
 * @param component - The normalized component.
 * @param targetKey - The key of the target extension being built.
 * @param rootPath - The path of the component's children: `children`, or
 *   `''` for a node-array template.
 * @returns One warning per element, naming the events left out.
 *
 * @example
 * // <input> events: input → handleInput, keydown → handleKey;
 * // extensions.react.events: [{ name: 'change', handler: 'handleInput' }]
 * collectEventOverrideWarnings(component, 'react', 'children');
 * // → one warning naming keydown, at children[0].extensions.react.events
 */
export function collectEventOverrideWarnings(
  component: NormalizedComponent,
  targetKey: string,
  rootPath: string
): Warning[] {
  const warnings: Warning[] = [];
  visitNodes(component.children, rootPath, (node, path) => {
    if (node.type !== 'element' || !Array.isArray(node.events)) {
      return;
    }
    const override = (node.extensions as Record<string, unknown> | undefined)?.[
      targetKey
    ];
    if (typeof override !== 'object' || override === null) {
      return;
    }
    const { events } = override as { events?: unknown };
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }
    const left = leftOutEvents(node.events, events as EventDefinition[]);
    if (left.length === 0) {
      return;
    }
    const names = left.join(', ');
    warnings.push({
      message:
        `The ${targetKey} events override on <${staticTagOf(node.tag)}> leaves out ${names}, ` +
        `which the element declares, so the ${targetKey} output does not handle ${left.length === 1 ? 'it' : 'them'}; ` +
        'the override replaces the whole event list, so list each event the element keeps in it; ' +
        'an event of another name replaces a left-out one when it takes the same handler, or when it is change replacing input',
      nodePath: `${path}.extensions.${targetKey}.events`,
    });
  });
  return warnings;
}

/** The names of the declared events the override neither repeats nor
 *  replaces: with an event of another name taking the same handler, or
 *  with `change` for `input`. */
function leftOutEvents(
  declared: readonly EventDefinition[],
  override: readonly EventDefinition[]
): string[] {
  const overrideNames = new Set(override.map((event) => event?.name));
  const declaredNames = new Set(declared.map((event) => event.name));
  // Override events of a name the element does not declare, each able to
  // stand in for one left-out event.
  const replacements = override.filter(
    (event) => !declaredNames.has(event?.name)
  );
  // Each declared event the override does not repeat by name is matched on
  // its own, so two declared events of one name need two replacements.
  const missing = declared.filter((event) => !overrideNames.has(event.name));
  // A replacement taking the same handler first, then `change` for `input`.
  const left = missing.filter(
    (event) =>
      !takeReplacement(
        replacements,
        (candidate) => handlerOf(candidate) === handlerOf(event)
      )
  );
  return left
    .filter(
      (event) =>
        !(
          event.name === 'input' &&
          takeReplacement(
            replacements,
            (candidate) => candidate?.name === 'change'
          )
        )
    )
    .map((event) => event.name)
    .filter((name, index, names) => names.indexOf(name) === index);
}

/** Removes the first replacement that matches and reports whether one did. */
function takeReplacement(
  replacements: EventDefinition[],
  matches: (candidate: EventDefinition) => boolean
): boolean {
  const index = replacements.findIndex(matches);
  if (index === -1) {
    return false;
  }
  replacements.splice(index, 1);
  return true;
}

/** An event's handler as written, trimmed, for comparison. */
function handlerOf(event: EventDefinition | undefined): string | undefined {
  const handler = (event as { handler?: unknown } | undefined)?.handler;
  return typeof handler === 'string' ? handler.trim() : undefined;
}
