import type {
  AttributeOverrides,
  ComponentExtensionOverride,
  EventDefinition,
} from '@js-template-engine/types';

/**
 * Node-level overrides for the Svelte extension, carried under
 * `extensions.svelte` on element nodes.
 *
 * `tag` replaces the node's element for the Svelte render; `attributes` merges
 * into the node's attributes per key, the override winning, and a
 * `null` value removing the node's attribute of that name; `events` replaces
 * the node's event list. Override attributes render verbatim, which is how
 * framework-specific bindings without a generic concept - the `bind:` family -
 * are authored.
 *
 * @example
 * const node: ElementNode = {
 *   type: 'element',
 *   tag: 'input',
 *   extensions: {
 *     svelte: { attributes: { 'bind:value': { $expression: 'name' } } },
 *   },
 * };
 */
export interface SvelteNodeOverrides {
  /**
   * Replaces the node's resolved tag for the Svelte render. A capitalized
   * value is emitted as a component reference (`'Modal'` → `<Modal>`); pair it
   * with the component-level `imports` override to bring the component into
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
  /**
   * Svelte warning codes to silence on this element, emitted as a
   * `<!-- svelte-ignore <codes> -->` comment directly before it in Svelte
   * output only - for a warning the element's markup cannot avoid, such as an
   * accessibility rule on a deliberate pointer shortcut. Other targets render
   * no comment.
   *
   * @example
   * extensions: {
   *   svelte: { ignore: ['a11y_click_events_have_key_events', 'a11y_no_static_element_interactions'] },
   * }
   */
  ignore?: string[];
}

/**
 * The component-level override for the Svelte extension, carried under
 * `extensions.svelte` on the component.
 *
 * The shared keys (`script`, `imports`, `style`, `props` and their
 * strategies) apply in both Svelte modes. `legacy` and `runes` are override
 * blocks of the same shape that apply only when the extension emits that
 * mode, on top of the shared keys and with the same strategies - so one
 * template carries a legacy script using `$:` beside a runes script using
 * `$derived`, each rendered only in its own mode.
 *
 * @example
 * extensions: {
 *   svelte: {
 *     script: 'function increment() {\n  count += 1;\n}',
 *     legacy: { script: '$: doubled = count * 2;' },
 *     runes: { script: 'const doubled = $derived(count * 2);' },
 *   },
 * }
 */
export interface SvelteComponentOverride extends ComponentExtensionOverride {
  /** Applied after the shared keys when the extension emits legacy Svelte. */
  legacy?: ComponentExtensionOverride;
  /** Applied after the shared keys when the extension emits runes Svelte. */
  runes?: ComponentExtensionOverride;
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    svelte?: SvelteNodeOverrides;
  }
  interface ComponentExtensionOverrides {
    svelte?: SvelteComponentOverride;
  }
}
