/**
 * Core concept interfaces for the new extension system.
 * These interfaces represent common patterns abstracted from framework-specific implementations.
 */

/**
 * Base interface for all concepts with node reference.
 */
export interface BaseConcept {
  /** Reference to the original template node for debugging */
  nodeId: string;
}

/**
 * Event concept representing user interactions.
 */
export interface EventConcept extends BaseConcept {
  /** Event name (click, change, submit, etc.) */
  name: string;
  /** Handler function name or expression */
  handler: string;
  /** Event modifiers (prevent, stop, once, etc.) */
  modifiers?: string[];
  /** Parameters passed to the handler */
  parameters?: string[];
}

/**
 * Styling concept for static and dynamic classes.
 */
export interface StylingConcept extends BaseConcept {
  /** Static CSS classes */
  staticClasses: string[];
  /** Dynamic class expressions */
  dynamicClasses: string[];
  /** Inline style object */
  inlineStyles: Record<string, string>;
  /** Framework-specific style bindings */
  styleBindings?: Record<string, string>;
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