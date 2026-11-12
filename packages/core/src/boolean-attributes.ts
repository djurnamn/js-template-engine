/**
 * HTML boolean attributes: present means on, whatever the value, so
 * `checked="false"` checks an input. Each maps to the elements it is
 * boolean on, or to `'global'` for one every HTML element takes. Lower-case,
 * as HTML spells them. `hidden` also takes the value `until-found`, which a
 * bound boolean cannot express.
 */
export const BOOLEAN_ATTRIBUTES: ReadonlyMap<
  string,
  'global' | ReadonlySet<string>
> = new Map<string, 'global' | ReadonlySet<string>>([
  ['autofocus', 'global'],
  ['hidden', 'global'],
  ['inert', 'global'],
  ['itemscope', 'global'],
  ['allowfullscreen', new Set(['iframe'])],
  ['alpha', new Set(['input'])],
  ['async', new Set(['script'])],
  ['autoplay', new Set(['audio', 'video'])],
  ['checked', new Set(['input'])],
  ['controls', new Set(['audio', 'video'])],
  ['default', new Set(['track'])],
  ['defer', new Set(['script'])],
  [
    'disabled',
    new Set([
      'button',
      'fieldset',
      'input',
      'link',
      'optgroup',
      'option',
      'select',
      'textarea',
    ]),
  ],
  ['disablepictureinpicture', new Set(['video'])],
  ['disableremoteplayback', new Set(['audio', 'video'])],
  ['formnovalidate', new Set(['button', 'input'])],
  ['ismap', new Set(['img'])],
  ['loop', new Set(['audio', 'video'])],
  ['multiple', new Set(['input', 'select'])],
  ['muted', new Set(['audio', 'video'])],
  ['nomodule', new Set(['script'])],
  ['novalidate', new Set(['form'])],
  ['open', new Set(['details', 'dialog'])],
  ['playsinline', new Set(['video'])],
  ['readonly', new Set(['input', 'textarea'])],
  ['required', new Set(['input', 'select', 'textarea'])],
  ['reversed', new Set(['ol'])],
  ['selected', new Set(['option'])],
  ['shadowrootclonable', new Set(['template'])],
  ['shadowrootdelegatesfocus', new Set(['template'])],
  ['shadowrootserializable', new Set(['template'])],
]);

/**
 * Whether an attribute is an HTML boolean attribute on the given element.
 * HTML attribute names are case-insensitive, so `readOnly` is `readonly`. A
 * custom element (a tag with a hyphen) decides its own attributes, so none is
 * boolean on it here.
 *
 * @param name - The attribute name, as authored.
 * @param tag - The element's tag.
 * @returns `true` for a boolean attribute such as `checked` on an input or
 *   `disabled` on a button.
 */
export function isBooleanAttribute(name: string, tag: string): boolean {
  if (tag.includes('-')) {
    return false;
  }
  const elements = BOOLEAN_ATTRIBUTES.get(name.toLowerCase());
  return (
    elements === 'global' ||
    (elements !== undefined && elements.has(tag.toLowerCase()))
  );
}

/**
 * DOM properties a template may bind that have no HTML attribute, each
 * mapped to the elements it is a property of: markup cannot set them, since
 * a browser reads no such attribute. Lower-case, as HTML spells attribute
 * names.
 */
export const PROPERTY_ONLY_NAMES: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map([['indeterminate', new Set(['input'])]]);

/**
 * Whether a name is a DOM property with no HTML attribute on the given
 * element, such as an input's `indeterminate`. A custom element (a tag with
 * a hyphen) decides its own attributes, so none is property-only on it here.
 *
 * @param name - The attribute name, as authored.
 * @param tag - The element's tag.
 * @returns `true` for `indeterminate` on an input.
 */
export function isPropertyOnlyName(name: string, tag: string): boolean {
  if (tag.includes('-')) {
    return false;
  }
  return (
    PROPERTY_ONLY_NAMES.get(name.toLowerCase())?.has(tag.toLowerCase()) ?? false
  );
}
