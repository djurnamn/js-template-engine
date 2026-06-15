import type { Template } from './template-nodes';

/**
 * Identity helper that gives template authors compile-time checking and
 * autocompletion.
 *
 * @param template - The template definition: a root component node or a
 * bare node array.
 * @returns The template, unchanged.
 *
 * @example
 * export default defineTemplate({
 *   type: 'component',
 *   name: 'Button',
 *   children: [],
 * });
 */
export function defineTemplate<T extends Template>(template: T): T {
  return template;
}
