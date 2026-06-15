/**
 * Command-line interface for the JS Template Engine.
 *
 * The `js-template-engine` binary renders data-defined component templates
 * to HTML, React, Vue, or Svelte (`render`) and validates template files
 * (`validate`). This module exposes the program and its building blocks
 * for programmatic use.
 */
export { componentNameFromFilePath } from './component-name';
export { renderCommand, type RenderCommandOptions } from './commands/render';
export { validateCommand } from './commands/validate';
export {
  buildExtensions,
  frameworkNames,
  stylingNames,
  type FrameworkName,
  type StylingName,
} from './extensions';
export { writeOutputFiles } from './output';
export { createProgram, parseStylingList } from './program';
export { loadTemplate, resolveTemplateSources } from './template-sources';
