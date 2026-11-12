/** The name of the generated helper that resolves a surface attribute. */
export const AUTHORED_OR_CONSUMER = 'authoredOrConsumer';

/**
 * The generated helper a scripted target declares beside a component whose
 * passthrough surface binds an attribute to an expression: the authored value,
 * or the consumer's attribute of the same name when the authored one resolves
 * to `undefined` or `null`. A function rather than an inline `??`, so a
 * never-nullish authored expression type-checks (TypeScript rejects an
 * unreachable `??` operand) and a name the element's props type lacks, such as
 * a `data-*` attribute, reads through a widened record.
 *
 * @returns The TypeScript function declaration
 * @example
 * // role={authoredOrConsumer(decorative ? 'none' : 'separator', rest, 'role')}
 */
export function authoredOrConsumerDeclaration(): string {
  return [
    `function ${AUTHORED_OR_CONSUMER}<T>(authored: T, consumer: object, name: string): T {`,
    '  return (authored ?? (consumer as Record<string, unknown>)[name]) as T;',
    '}',
  ].join('\n');
}
