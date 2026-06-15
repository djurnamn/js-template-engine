import { basename, extname } from 'node:path';

/**
 * Derives a component name from a template file path.
 *
 * The file's base name is split on every non-alphanumeric character and the
 * segments are joined in PascalCase: `theme-toggle.json` → `ThemeToggle`,
 * `user_card.ts` → `UserCard`. A name starting with a digit is prefixed
 * with an underscore to stay a valid JavaScript identifier.
 *
 * Used when the template carries no component name of its own and no
 * `--component-name` flag is given.
 *
 * @param filePath - The template file path.
 * @returns The derived component name.
 */
export function componentNameFromFilePath(filePath: string): string {
  const stem = basename(filePath, extname(filePath));
  const name = stem
    .split(/[^a-zA-Z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
  if (name === '') {
    return 'Component';
  }
  return /^[0-9]/.test(name) ? `_${name}` : name;
}
