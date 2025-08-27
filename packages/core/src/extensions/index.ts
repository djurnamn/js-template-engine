/**
 * Extension interfaces for the new concept-driven architecture.
 */

import type {
  ComponentConcept,
  EventConcept,
  StylingConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
} from '../concepts';

/**
 * Extension metadata.
 */
export interface ExtensionMetadata {
  /** Extension type */
  type: 'framework' | 'styling' | 'utility';
  /** Unique extension key */
  key: string;
  /** Display name */
  name: string;
  /** Extension version */
  version: string;
}

/**
 * Base extension interface.
 */
export interface Extension {
  /** Extension metadata */
  metadata: ExtensionMetadata;
}

/**
 * Framework-specific outputs for each concept type.
 */
export interface FrameworkEventOutput {
  /** Rendered event attributes */
  attributes: Record<string, string>;
  /** Required imports for events */
  imports?: string[];
}

export interface FrameworkConditionalOutput {
  /** Rendered conditional syntax */
  syntax: string;
  /** Required imports */
  imports?: string[];
}

export interface FrameworkIterationOutput {
  /** Rendered iteration syntax */
  syntax: string;
  /** Required imports */
  imports?: string[];
}

export interface FrameworkSlotOutput {
  /** Rendered slot syntax */
  syntax: string;
  /** Props needed for slots */
  props?: Record<string, string>;
  /** Required imports */
  imports?: string[];
}

export interface FrameworkAttributeOutput {
  /** Rendered attributes */
  attributes: Record<string, string>;
  /** Required imports */
  imports?: string[];
}

/**
 * Render context for framework extensions.
 */
export interface RenderContext {
  /** Component metadata */
  component?: any;
  /** Framework options */
  options?: Record<string, any>;
  /** Additional context */
  [key: string]: any;
}

/**
 * Framework extension interface.
 */
export interface FrameworkExtension extends Extension {
  /** Framework extension metadata */
  metadata: ExtensionMetadata & { type: 'framework' };
  /** Target framework */
  framework: 'react' | 'vue' | 'svelte';

  /** Process event concepts */
  processEvents(events: EventConcept[]): FrameworkEventOutput;
  /** Process conditional concepts */
  processConditionals(
    conditionals: ConditionalConcept[]
  ): FrameworkConditionalOutput;
  /** Process iteration concepts */
  processIterations(iterations: IterationConcept[]): FrameworkIterationOutput;
  /** Process slot concepts */
  processSlots(slots: SlotConcept[]): FrameworkSlotOutput;
  /** Process attribute concepts */
  processAttributes(attributes: AttributeConcept[]): FrameworkAttributeOutput;

  /** Render final component */
  renderComponent(concepts: ComponentConcept, context: RenderContext): string;
}

/**
 * Style output format.
 */
export interface StyleOutput {
  /** Generated CSS/SCSS */
  styles: string;
  /** Required imports */
  imports?: string[];
  /** Updated styling concepts with generated classes */
  updatedStyling?: StylingConcept;
}

/**
 * Styling extension interface.
 */
export interface StylingExtension extends Extension {
  /** Styling extension metadata */
  metadata: ExtensionMetadata & { type: 'styling' };
  /** Styling approach */
  styling: 'bem' | 'tailwind' | 'css-modules' | 'styled-components';

  /** Process styling concepts */
  processStyles(concept: StylingConcept): StyleOutput;
  /** Convert between style formats */
  convertFormat?(from: string, to: string): StyleOutput | null;
}

/**
 * Utility extension interface for future use.
 */
export interface UtilityExtension extends Extension {
  /** Utility extension metadata */
  metadata: ExtensionMetadata & { type: 'utility' };
  /** Utility type */
  utility: string;

  /** Process utility functions */
  process(concepts: ComponentConcept): ComponentConcept;
}

/**
 * Union type for all extension types.
 */
export type AnyExtension =
  | FrameworkExtension
  | StylingExtension
  | UtilityExtension;
