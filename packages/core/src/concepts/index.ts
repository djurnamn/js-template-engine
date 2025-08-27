/**
 * Core concept interfaces defining the conceptual model for template processing.
 * 
 * This module provides comprehensive type definitions for all template concepts
 * that can be extracted and processed by the template engine. These interfaces
 * represent framework-agnostic abstractions that enable consistent processing
 * across React, Vue, Svelte, and other supported frameworks.
 * 
 * The concept system provides a unified model for:
 * - Structural elements (DOM hierarchy, text, comments)
 * - Behavioral patterns (events, conditionals, iterations)
 * - Styling abstractions (classes, inline styles, framework bindings)
 * - Component composition (slots, attributes, metadata)
 * 
 * @example
 * ```typescript
 * // Example of extracted concepts from a template
 * const componentConcept: ComponentConcept = {
 *   structure: [
 *     { nodeId: '0', type: 'element', tag: 'div', children: [...] }
 *   ],
 *   events: [
 *     { nodeId: '0-1', name: 'click', handler: 'handleClick', modifiers: ['prevent'] }
 *   ],
 *   styling: {
 *     nodeId: 'root',
 *     staticClasses: ['container', 'active'],
 *     dynamicClasses: ['isVisible && "show"']
 *   },
 *   // ... other concepts
 * };
 * ```
 * 
 * @since 2.0.0
 */

/**
 * Base interface for all template concepts providing node traceability.
 * 
 * All concepts extend this interface to maintain references back to their
 * originating template nodes, enabling debugging, error reporting, and
 * source mapping capabilities.
 * 
 * @public
 */
export interface BaseConcept {
  /** 
   * Unique identifier referencing the original template node.
   * Used for debugging, error reporting, and source mapping.
   */
  nodeId: string;
}

/**
 * Event concept representing user interaction handlers in templates.
 * 
 * EventConcept abstracts framework-specific event handling patterns into
 * a common interface, supporting various event binding syntaxes and modifiers
 * across React, Vue, Svelte, and other frameworks.
 * 
 * @example
 * ```typescript
 * // React: <button onClick={handleClick}>
 * // Vue: <button @click="handleClick">
 * // Svelte: <button on:click={handleClick}>
 * 
 * const eventConcept: EventConcept = {
 *   nodeId: '0-1',
 *   name: 'click',
 *   handler: 'handleClick',
 *   modifiers: ['prevent', 'stop'],
 *   parameters: ['$event', 'index']
 * };
 * ```
 * 
 * @public
 */
export interface EventConcept extends BaseConcept {
  /** 
   * Normalized event name (e.g., 'click', 'change', 'submit').
   * Abstracted from framework-specific naming conventions.
   */
  name: string;
  /** 
   * Handler function name or expression to execute.
   * Can be a simple function name or complex expression.
   */
  handler: string;
  /** 
   * Original framework-specific attribute name for reference.
   * Examples: 'onClick', '@click', 'on:click', 'v-on:click'
   */
  frameworkAttribute?: string;
  /** 
   * Event modifiers affecting behavior.
   * Examples: ['prevent', 'stop', 'once', 'passive', 'capture']
   */
  modifiers?: string[];
  /** 
   * Parameters passed to the event handler.
   * Examples: ['$event', 'index', 'item.id']
   */
  parameters?: string[];
}

/**
 * Styling concept for CSS classes, inline styles, and framework-specific style bindings.
 * 
 * StylingConcept provides a unified model for handling static and dynamic styling
 * across different frameworks and styling approaches. It supports traditional CSS
 * classes, inline styles, and framework-specific bindings while providing extension
 * points for styling systems like BEM, Tailwind, and CSS-in-JS.
 * 
 * @example
 * ```typescript
 * // React: <div className={`btn ${isActive ? 'active' : ''}`} style={{ color: 'red' }}>
 * // Vue: <div :class="['btn', { active: isActive }]" :style="{ color: 'red' }">
 * 
 * const stylingConcept: StylingConcept = {
 *   nodeId: 'root',
 *   staticClasses: ['btn', 'container'],
 *   dynamicClasses: ['isActive && "active"', '{ disabled: !enabled }'],
 *   inlineStyles: { color: 'red', fontSize: '16px' },
 *   styleBindings: { style: '{ color: dynamicColor }' },
 *   extensionData: {
 *     tailwind: [{ nodeId: '0', utilities: ['bg-blue-500', 'text-white'] }]
 *   }
 * };
 * ```
 * 
 * @public
 */
export interface StylingConcept extends BaseConcept {
  /** 
   * Static CSS class names applied to elements.
   * These are literal class names that don't change at runtime.
   */
  staticClasses: string[];
  /** 
   * Dynamic class expressions that are evaluated at runtime.
   * Examples: 'isActive && "active"', '{ disabled: !enabled }'
   */
  dynamicClasses: string[];
  /** 
   * Inline style properties with static values.
   * Represents style="property: value" declarations.
   */
  inlineStyles: Record<string, string>;
  /** 
   * Framework-specific dynamic style bindings.
   * Examples: React's style prop, Vue's :style directive
   */
  styleBindings?: Record<string, string>;
  /** 
   * Extension-specific styling data for BEM, Tailwind, etc.
   * Indexed by extension key for efficient lookup.
   */
  extensionData?: Record<string, any>;
  /** 
   * Per-element class mappings for fine-grained styling control.
   * Maps node IDs to their specific class arrays.
   */
  perElementClasses?: Record<string, string[]>;
}

/**
 * Conditional rendering concept.
 */
export interface ConditionalConcept extends BaseConcept {
  /** Condition expression */
  condition: string;
  /** Nodes to render when condition is true */
  thenNodes: any[]; // TemplateNode[] - avoiding circular dependency
  /** Nodes to render when condition is false */
  elseNodes?: any[]; // TemplateNode[] - avoiding circular dependency
}

/**
 * Iteration/loop concept.
 */
export interface IterationConcept extends BaseConcept {
  /** Items collection expression */
  items: string;
  /** Item variable name */
  itemVariable: string;
  /** Index variable name */
  indexVariable?: string;
  /** Key expression for React-style keys */
  keyExpression?: string;
  /** Nodes to repeat for each item */
  childNodes: any[]; // TemplateNode[] - avoiding circular dependency
}

/**
 * Slot/content projection concept.
 */
export interface SlotConcept extends BaseConcept {
  /** Slot name */
  name: string;
  /** Fallback content when slot is empty */
  fallback?: any[]; // TemplateNode[] - avoiding circular dependency
}

/**
 * HTML attribute concept.
 */
export interface AttributeConcept extends BaseConcept {
  /** Attribute name */
  name: string;
  /** Attribute value */
  value: string | boolean;
  /** Whether the value is an expression */
  isExpression: boolean;
}

/**
 * Structural concept for template element hierarchy and content.
 */
export interface StructuralConcept extends BaseConcept {
  /** Element tag name */
  tag: string;
  /** Child elements and content */
  children: (StructuralConcept | TextConcept | CommentConcept | FragmentConcept)[];
  /** Element's own attributes (not behavioral ones like events) */
  attributes?: Record<string, any>;
  /** Whether this is a self-closing element */
  isSelfClosing?: boolean;
  /** Type identifier */
  type: 'element';
}

/**
 * Text content concept.
 */
export interface TextConcept extends BaseConcept {
  /** Text content */
  content: string;
  /** Type identifier */
  type: 'text';
}

/**
 * Comment content concept.
 */
export interface CommentConcept extends BaseConcept {
  /** Comment content */
  content: string;
  /** Type identifier */
  type: 'comment';
}

/**
 * Fragment concept for multiple root elements.
 */
export interface FragmentConcept extends BaseConcept {
  /** Child elements in fragment */
  children: (StructuralConcept | TextConcept | CommentConcept)[];
  /** Type identifier */
  type: 'fragment';
}

/**
 * Component metadata.
 */
export interface ComponentMetadata {
  /** Component name */
  name?: string;
  /** Component props */
  props?: Record<string, string>;
  /** Component imports */
  imports?: string[];
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Main component concept container.
 */
export interface ComponentConcept {
  /** Template structure and content */
  structure: (StructuralConcept | TextConcept | CommentConcept | FragmentConcept)[];
  /** Event handlers */
  events: EventConcept[];
  /** Styling information */
  styling: StylingConcept;
  /** Conditional rendering */
  conditionals: ConditionalConcept[];
  /** Iterations/loops */
  iterations: IterationConcept[];
  /** Slots/content projection */
  slots: SlotConcept[];
  /** HTML attributes */
  attributes: AttributeConcept[];
  /** Component metadata */
  metadata: ComponentMetadata;
}