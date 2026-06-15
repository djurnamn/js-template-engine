import { describe, expect, it } from 'vitest';

import { componentNameFromFilePath } from '../src/component-name';

describe('componentNameFromFilePath', () => {
  it('PascalCases a kebab-case filename', () => {
    expect(componentNameFromFilePath('/templates/theme-toggle.json')).toBe(
      'ThemeToggle'
    );
  });

  it('PascalCases a snake_case filename', () => {
    expect(componentNameFromFilePath('user_card.ts')).toBe('UserCard');
  });

  it('capitalizes a single-word filename', () => {
    expect(componentNameFromFilePath('button.json')).toBe('Button');
  });

  it('preserves inner casing of camelCase segments', () => {
    expect(componentNameFromFilePath('themeToggle.mjs')).toBe('ThemeToggle');
  });

  it('keeps digits inside the name', () => {
    expect(componentNameFromFilePath('grid-2-column.json')).toBe(
      'Grid2Column'
    );
  });

  it('prefixes a leading digit with an underscore', () => {
    expect(componentNameFromFilePath('123-card.json')).toBe('_123Card');
  });

  it('falls back to Component when nothing usable remains', () => {
    expect(componentNameFromFilePath('---.json')).toBe('Component');
  });
});
