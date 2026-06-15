/**
 * Tailwind extension for the JS Template Engine.
 *
 * Contributes Tailwind utility classes to element nodes —
 * `process(template, { extensions: [tailwind()] })` — or, with
 * `tailwind({ output: 'styles' })`, converts the utilities into
 * self-contained CSS through the engine's styling pipeline.
 */
export {
  tailwind,
  type TailwindExtension,
  type TailwindOptions,
} from './tailwind-extension';
export type { TailwindNodeOverrides } from './overrides';
