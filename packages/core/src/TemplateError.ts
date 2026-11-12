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
  /**
   * The individual errors when this one reports several together, as a
   * styling run does for every unconvertible utility; their messages and
   * paths are also listed in `message`. Absent on a single error.
   */
  readonly errors?: readonly TemplateErrorDetail[];

  constructor(
    message: string,
    nodePath = '',
    errors?: readonly TemplateErrorDetail[]
  ) {
    super(nodePath === '' ? message : `${message} (at ${nodePath})`);
    this.name = 'TemplateError';
    this.nodePath = nodePath;
    if (errors !== undefined) {
      this.errors = errors;
    }
  }
}

/** One error of a {@link TemplateError} that reports several. */
export interface TemplateErrorDetail {
  /** The error's message, without its node path. */
  message: string;
  /** The path of the offending node; empty for the template as a whole. */
  nodePath: string;
}

/**
 * The individual errors a {@link TemplateError} reports: its `errors` when it
 * reports several, otherwise the error itself, its message without the node
 * path the constructor appended.
 *
 * @param error - The error to list.
 * @returns One detail per reported error.
 */
export function templateErrorDetails(
  error: TemplateError
): readonly TemplateErrorDetail[] {
  if (error.errors !== undefined) {
    return error.errors;
  }
  const suffix = ` (at ${error.nodePath})`;
  const message =
    error.nodePath !== '' && error.message.endsWith(suffix)
      ? error.message.slice(0, -suffix.length)
      : error.message;
  return [{ message, nodePath: error.nodePath }];
}

/**
 * Throws recorded errors as one `TemplateError`: a single error as it is,
 * several listed one per line under a count, each with its node path, and
 * carried on the error's `errors`.
 *
 * @param errors - The recorded errors; at least one.
 * @param kind - What the errors are, for the count line (`'styling'`).
 */
export function throwTemplateErrors(
  errors: readonly TemplateErrorDetail[],
  kind: string
): never {
  if (errors.length === 1) {
    throw new TemplateError(errors[0].message, errors[0].nodePath);
  }
  throw new TemplateError(
    [
      `${errors.length} ${kind} errors:`,
      ...errors.map(({ message, nodePath }) =>
        nodePath === '' ? `  ${message}` : `  ${message} (at ${nodePath})`
      ),
    ].join('\n'),
    '',
    errors
  );
}
