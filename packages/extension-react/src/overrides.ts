import type {
  AttributeOverrides,
  ComponentExtensionOverride,
  EventDefinition,
} from '@js-template-engine/types';

/**
 * Node-level overrides for the React extension, carried under
 * `extensions.react` on element nodes.
 *
 * `tag` replaces the node's element for the React render; `attributes` merges
 * into the node's attributes per key, the override winning, and a
 * `null` value removing the node's attribute of that name; `events` replaces
 * the node's event list. Resolution follows the template format's priority:
 * extension-specific override → generic concept → nothing.
 *
 * @example
 * const node: ElementNode = {
 *   type: 'element',
 *   tag: 'button',
 *   events: [{ name: 'click', handler: 'handleClick' }],
 *   extensions: {
 *     react: { events: [{ name: 'click', handler: 'handleReactClick' }] },
 *   },
 * };
 */
export interface ReactNodeOverrides {
  /**
   * Replaces the node's resolved tag for the React render. A capitalized
   * value is emitted as a component reference (`'Portal'` → `<Portal>`); pair
   * it with the component-level `imports` override to bring the component into
   * scope.
   */
  tag?: string;
  /**
   * Merges into the node's attributes per key, the override winning. A key
   * set to `null` removes the node's attribute of that name in this target
   * alone.
   */
  attributes?: AttributeOverrides;
  events?: EventDefinition[];
}

/**
 * Component-level overrides for the React extension. Extends the shared
 * component override with `client`, which marks the generated file as a
 * client module (`'use client';` as its first statement) for frameworks with
 * server components, such as the Next.js App Router - needed when the
 * component hands a function to a client component, as a compound passing a
 * render-prop child to a driver does.
 *
 * @example
 * defineTemplate({
 *   type: 'component',
 *   name: 'Select',
 *   extensions: { react: { client: true } },
 *   children: [],
 * });
 */
export interface ReactComponentOverride extends ComponentExtensionOverride {
  /** Emit `'use client';` as the file's first statement. Defaults to `false`. */
  client?: boolean;
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    react?: ReactNodeOverrides;
  }
  interface ComponentExtensionOverrides {
    react?: ReactComponentOverride;
  }
}
