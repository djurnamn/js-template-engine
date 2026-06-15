/**
 * Node-level overrides for the Tailwind extension, carried under
 * `extensions.tailwind` on element nodes.
 *
 * `classes` accepts an array (canonical) or a space-separated string, and
 * passes through verbatim: responsive and pseudo-class variants are spelled
 * inline (`md:px-6`, `hover:bg-blue-700`).
 *
 * @example
 * const node: ElementNode = {
 *   type: 'element',
 *   tag: 'button',
 *   extensions: {
 *     tailwind: { classes: ['px-4', 'py-2', 'hover:bg-blue-700'] },
 *   },
 * };
 */
export interface TailwindNodeOverrides {
  /** Tailwind utility classes, contributed in declared order. */
  classes?: string | string[];
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    tailwind?: TailwindNodeOverrides;
  }
}
