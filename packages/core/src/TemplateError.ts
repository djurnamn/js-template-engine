/**
 * A fatal template processing error.
 *
 * Thrown by `process()` when a template violates a structural rule or when
 * processing options are contradictory. `nodePath` points at the offending
 * location in the template data (for example `children[2].conditions[0]`);
 * it is empty when the error concerns the template or options as a whole.
 */
export class TemplateError extends Error {
  /** The path of the offending node, such as `'children[2].conditions[0]'`. */
  readonly nodePath: string;

  constructor(message: string, nodePath = '') {
    super(nodePath === '' ? message : `${message} (at ${nodePath})`);
    this.name = 'TemplateError';
    this.nodePath = nodePath;
  }
}
