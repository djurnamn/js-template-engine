/**
 * The type a generated props declaration gives an optional prop: its
 * declared type widened with `| undefined`, so a consumer compiling with
 * `exactOptionalPropertyTypes` can pass `undefined` explicitly (forwarding
 * one optional prop to another, `<Frame border={border}>`). A type that
 * already admits `undefined` - one with `undefined`, `any` or `unknown` as a
 * top-level union member - is kept as written; a function or conditional type
 * is parenthesized first, so the union is the prop's and not its return
 * type's or false branch's.
 *
 * @param type - The prop's declared type, as code.
 * @returns The type with `| undefined`, as code.
 * @example
 * optionalPropType('string'); // 'string | undefined'
 * optionalPropType('boolean | undefined'); // 'boolean | undefined'
 * optionalPropType('any'); // 'any'
 * optionalPropType('() => void'); // '(() => void) | undefined'
 */
export function optionalPropType(type: string): string {
  const trimmed = type.trim();
  const { members, compound } = topLevelOf(trimmed);
  if (compound) {
    return `(${trimmed}) | undefined`;
  }
  return members.some((member) => ADMITS_UNDEFINED.has(member))
    ? trimmed
    : `${trimmed} | undefined`;
}

/** The top-level union members that already admit `undefined`. */
const ADMITS_UNDEFINED = new Set(['undefined', 'any', 'unknown']);

/**
 * A type's top-level union members, and whether its top level is a function
 * or conditional type - one a `| undefined` appended to would bind inside,
 * to the return type or the false branch.
 */
function topLevelOf(type: string): { members: string[]; compound: boolean } {
  const members: string[] = [];
  let compound = false;
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < type.length; i += 1) {
    const character = type[i];
    if (quote !== '') {
      if (character === '\\') {
        i += 1;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    } else if (character === '=' && type[i + 1] === '>') {
      compound ||= depth === 0;
      i += 1;
    } else if ('([{<'.includes(character)) {
      depth += 1;
    } else if (')]}>'.includes(character)) {
      depth -= 1;
    } else if (depth === 0 && character === '?') {
      compound = true;
    } else if (depth === 0 && character === '|') {
      members.push(type.slice(start, i).trim());
      start = i + 1;
    }
  }
  members.push(type.slice(start).trim());
  return { members, compound };
}
