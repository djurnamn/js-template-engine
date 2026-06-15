import type {
  Attributes,
  ComponentExtensionOverride,
  EventDefinition,
} from '@js-template-engine/types';

/**
 * Node-level overrides for the React extension, carried under
 * `extensions.react` on element nodes.
 *
 * `attributes` merges into the node's attributes per key, the override
 * winning; `events` replaces the node's event list. Resolution follows the
 * template format's priority: extension-specific override → generic
 * concept → nothing.
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
  attributes?: Attributes;
  events?: EventDefinition[];
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    react?: ReactNodeOverrides;
  }
  interface ComponentExtensionOverrides {
    react?: ComponentExtensionOverride;
  }
}
