import type {
  ElementNode,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import { resolveComponentOverrides } from './component-overrides';
import { scriptWords } from './local-bindings';
import { normalizeNamedSlots } from './slots';
import type { NormalizedComponent } from './normalize';
import { visitNodes } from './traverse';
import { fragmentWrapper } from './fragment-wrapper';

const WORD = /[A-Za-z_$][\w$]*/g;

/**
 * The names a component's import statements and other module-scope
 * declarations bring into scope, read loosely: every word outside a string
 * literal, except a type-only import's and a `type`-marked specifier's, which
 * name no value a tag can render.
 */
function importedNames(imports: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const statement of imports) {
    const values = statement
      .replace(/\bimport\s+type\b[^;]*?\bfrom\s*(['"`])[^'"`]*\1/g, '')
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
      .replace(/\btype\s+[A-Za-z_$][\w$]*/g, '');
    for (const word of values.match(WORD) ?? []) {
      names.add(word);
    }
  }
  return names;
}

/** The tag an element renders under in a target: its override, or its own. */
function targetTagOf(
  node: ElementNode,
  extensionKey: string
): string | undefined {
  const override = node.extensions?.[extensionKey] as
    | { tag?: unknown }
    | undefined;
  if (typeof override?.tag === 'string') {
    return override.tag;
  }
  return typeof node.tag === 'string' ? node.tag : undefined;
}

/**
 * Warns where an element renders a component reference - a capitalized tag,
 * its own or the target's `tag` override, or a fragment's wrapper `tag` for
 * the target - whose name nothing in the
 * component brings into scope, so a missing import of a composed component
 * does not pass silently until the generated file fails to compile. A name is
 * in scope when the target's imports (the component's and the target's
 * `imports` override) or the component `script` mention it, or it is a prop,
 * a `slotScope` entry, an iteration binding, the component's own name or one
 * of the target's built-in components. For a member tag (`Select.Root`)
 * the first segment is the name. The reading is loose - any word of an
 * import or the script counts - so a warning is never a false alarm about a
 * name the author did bring in.
 *
 * @param component - The normalized component.
 * @param extensionKey - The target extension's name (`react`, ...).
 * @param builtInComponents - The capitalized tags the target provides
 *   without an import (Vue's `Transition`, ...).
 * @param rootPath - The path of the component's children: `children`, or
 *   `''` for a node-array template.
 * @param globalRegistration - Whether the target resolves a component
 *   registered globally (Vue's `app.component`, a router's `RouterLink`), so
 *   the warning says the name may still resolve that way.
 * @param resolveOverrides - Applies the target's component overrides;
 *   defaults to `resolveComponentOverrides` for `extensionKey`.
 * @returns One warning per unresolved name, at its first element.
 * @example
 * // tag: 'UserAvatar' with no import naming it, for react:
 * // "<UserAvatar> is not in scope in the react output: ..."
 */
export function collectComponentReferenceWarnings(
  component: NormalizedComponent,
  extensionKey: string,
  builtInComponents: readonly string[] = [],
  rootPath = 'children',
  globalRegistration = false,
  resolveOverrides: (component: NormalizedComponent) => NormalizedComponent = (
    base
  ) => resolveComponentOverrides(base, extensionKey)
): Warning[] {
  const resolved = resolveOverrides(component);
  const inScope = importedNames(resolved.imports);
  for (const word of scriptWords(resolved.script)) {
    inScope.add(word);
  }
  inScope.add(resolved.name);
  for (const name of [...Object.keys(resolved.props), ...builtInComponents]) {
    inScope.add(name);
  }
  const references: Array<{ name: string; path: string }> = [];
  visitNodes(resolved.children, rootPath, (node: TemplateNode, nodePath) => {
    if (node.type === 'iteration') {
      inScope.add(node.item);
      if (node.index !== undefined) {
        inScope.add(node.index);
      }
      return;
    }
    if (node.type === 'conditional') {
      for (const branch of node.conditions) {
        for (const name of Object.keys(branch.props ?? {})) {
          inScope.add(name);
        }
      }
      return;
    }
    // A fragment renders a tag only where its override names a wrapper.
    const element =
      node.type === 'fragment' ? fragmentWrapper(node, extensionKey) : node;
    if (element?.type !== 'element') {
      return;
    }
    for (const name of element.slotScope ?? []) {
      inScope.add(name);
    }
    for (const named of normalizeNamedSlots(element.slots)) {
      for (const name of named.slotScope) {
        inScope.add(name);
      }
    }
    const tag = targetTagOf(element, extensionKey);
    const name = tag?.split('.')[0];
    if (name !== undefined && /^[A-Z]/.test(name)) {
      references.push({ name, path: nodePath });
    }
  });

  const warned = new Set<string>();
  const warnings: Warning[] = [];
  for (const { name, path } of references) {
    if (inScope.has(name) || warned.has(name)) {
      continue;
    }
    warned.add(name);
    warnings.push({
      message:
        `<${name}> is not in scope in the ${extensionKey} output: no import, prop or binding ` +
        `of the component names it, so the generated file will not compile` +
        (globalRegistration
          ? ' unless the component is registered globally'
          : '') +
        `. Import it in imports, or in extensions.${extensionKey}.imports where the module ` +
        `path differs per target.`,
      nodePath: path,
    });
  }
  return warnings;
}
