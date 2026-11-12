import { describe, expect, it } from 'vitest';

import { directiveValue, interpolation } from '../src/literals';

describe('directiveValue', () => {
  it('double-quotes an expression without a double quote, verbatim', () => {
    expect(directiveValue(" open && count > 0 ? 'a' : 'b' ")).toBe(`"open && count > 0 ? 'a' : 'b'"`);
  });

  it('single-quotes an expression with a double quote and no single quote', () => {
    expect(directiveValue('`${open ? "Close" : "Open"} ${label}`')).toBe(`'\`\${open ? "Close" : "Open"} \${label}\`'`);
  });

  it('rewrites double-quoted strings single-quoted when the expression holds both quotes', () => {
    expect(directiveValue(`open ? "Don't" : 'Do'`)).toBe(`"open ? 'Don\\'t' : 'Do'"`);
    expect(directiveValue(`'say "hi"' + "x"`)).toBe(`"'say \\x22hi\\x22' + 'x'"`);
    expect(directiveValue(`"a\\"b" + 'c'`)).toBe(`"'a\\x22b' + 'c'"`);
  });

  it("writes a template literal's double quotes as an escape, and its expressions as code", () => {
    expect(directiveValue('`"${label}" isn\'t ${open ? "on" : \'off\'}` + { a: 1 }.a')).toBe(
      `"\`\\x22\${label}\\x22 isn't \${open ? 'on' : 'off'}\` + { a: 1 }.a"`
    );
  });

  it('falls back to the entity when a double quote is in no string', () => {
    expect(directiveValue(`/"'/.test(value)`)).toBe(`"/&quot;'/.test(value)"`);
  });

  it('leaves a regular expression to the entity, never rewriting its quotes', () => {
    expect(directiveValue(`/"x"/.test(a) && b === 'c'`)).toBe(`"/&quot;x&quot;/.test(a) && b === 'c'"`);
    expect(directiveValue(`count / 2 > 1 ? "it's" : 'no'`)).toBe(`"count / 2 > 1 ? &quot;it's&quot; : 'no'"`);
  });

  it('leaves a tagged template to the entity, whose raw text a rewrite would change', () => {
    expect(directiveValue('String.raw`"${a}"` + \'b\'')).toBe('"String.raw`&quot;${a}&quot;` + \'b\'"');
    expect(directiveValue('tag `"x"` || \'y\'')).toBe('"tag `&quot;x&quot;` || \'y\'"');
  });
});

describe('interpolation', () => {
  it('wraps an expression in mustaches, trimmed', () => {
    expect(interpolation(' label ')).toBe('{{ label }}');
  });

  it('puts a space between adjacent closing braces in code', () => {
    expect(interpolation('JSON.stringify({ a: { b: n }})')).toBe(
      '{{ JSON.stringify({ a: { b: n } }) }}'
    );
    expect(interpolation('f({ a: { b: { c: n }}})')).toBe(
      '{{ f({ a: { b: { c: n } } }) }}'
    );
  });

  it('writes a closing brace that follows another in a string or template literal as an escape', () => {
    expect(interpolation("open ? '}}' : ''")).toBe("{{ open ? '\\x7d}' : '' }}");
    expect(interpolation("'}}}'")).toBe("{{ '\\x7d\\x7d}' }}");
    expect(interpolation('`${a}}`')).toBe('{{ `${a}\\x7d` }}');
    expect(interpolation('`}}${a}`')).toBe('{{ `}\\x7d${a}` }}');
  });

  it('spaces a brace closing a template expression, or an object inside one, from the one before it', () => {
    expect(interpolation('`${f({ a: { b }})}`')).toBe('{{ `${f({ a: { b } })}` }}');
    expect(interpolation('`${ { a }}`')).toBe('{{ `${ { a } }` }}');
  });

  it('leaves an expression with no adjacent closing braces as written', () => {
    expect(interpolation("items.map((item) => { return item; }).join(', ')")).toBe(
      "{{ items.map((item) => { return item; }).join(', ') }}"
    );
  });
});
