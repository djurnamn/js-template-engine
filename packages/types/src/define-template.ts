import type { ConditionalAttributes } from './attributes';
import type { EventDefinition } from './events';
import type { FragmentOverride } from './extension-overrides';
import type {
  CommentNode,
  ComponentNode,
  ConditionalBranch,
  ConditionalNode,
  DeclaredId,
  ElementNode,
  FragmentNode,
  IterationNode,
  PassthroughRouting,
  SlotNode,
  Template,
  TemplateNode,
  TextNode,
} from './template-nodes';

/** The keys a node of the given node's `type` takes. */
type NodeKeys<Node> = Node extends { type: 'component' }
  ? keyof ComponentNode
  : Node extends { type: 'element' }
    ? keyof ElementNode
    : Node extends { type: 'text' }
      ? keyof TextNode
      : Node extends { type: 'comment' }
        ? keyof CommentNode
        : Node extends { type: 'fragment' }
          ? keyof FragmentNode
          : Node extends { type: 'slot' }
            ? keyof SlotNode
            : Node extends { type: 'conditional' }
              ? keyof ConditionalNode
              : Node extends { type: 'iteration' }
                ? keyof IterationNode
                : never;

/**
 * An object whose every key its shape defines keeps its type, and whose
 * other keys must hold a marker no value matches, so an unknown key is a type
 * error at that key that names it as unknown.
 */
type ExactObject<Value, Keys, NodeType = unknown> = {
  [Key in keyof Value]: Key extends Keys
    ? ExactField<Key, Value[Key], NodeType>
    : { readonly 'unknown key, not taken by this node': Key };
};

/** Each entry of a list checked against one shape's keys. */
type ExactEntries<List, Keys> = List extends readonly unknown[]
  ? { [Index in keyof List]: ExactObject<List[Index], Keys> }
  : List;

/** Each node of a node list checked against its node type's keys. */
type ExactNodes<Nodes> = Nodes extends readonly unknown[]
  ? { [Index in keyof Nodes]: ExactNode<Nodes[Index]> }
  : Nodes;

/**
 * A node checked against its node type's keys. A node typed as the whole
 * `TemplateNode` union, such as one a helper returns, is already known to
 * hold only the keys of its type, and passes as it is.
 */
type ExactNode<Node> = [TemplateNode] extends [Node]
  ? Node
  : Node extends { type: infer NodeType }
    ? ExactObject<Node, NodeKeys<Node>, NodeType>
    : Node;

/** A named-slot projection: a node list, or `{ content, slotScope? }`. */
type ExactSlot<Slot> = Slot extends readonly unknown[]
  ? ExactNodes<Slot>
  : ExactObject<Slot, 'content' | 'slotScope'>;

/** Each named slot of a `slots` map checked in turn. */
type ExactSlots<Slots> = {
  [Name in keyof Slots]: ExactSlot<Slots[Name]>;
};

/** Each id of an `ids` map, its object form checked against its keys. */
type ExactIds<Ids> = {
  [Name in keyof Ids]: Ids[Name] extends object
    ? ExactObject<Ids[Name], keyof DeclaredId>
    : Ids[Name];
};

/**
 * A field's value, its nested nodes and entries checked in turn. A
 * fragment's `extensions` has each block checked against the fragment
 * override's keys; any other node's blocks stay open to their extensions.
 */
type ExactField<Key, Value, NodeType = unknown> = Key extends
  | 'children'
  | 'fallback'
  | 'content'
  ? ExactNodes<Value>
  : Key extends 'conditions'
    ? ExactEntries<Value, keyof ConditionalBranch>
    : Key extends 'conditionalAttributes'
      ? ExactEntries<Value, keyof ConditionalAttributes>
      : Key extends 'events'
        ? ExactEntries<Value, keyof EventDefinition>
        : Key extends 'slots'
          ? ExactSlots<Value>
          : Key extends 'passthrough'
            ? Value extends object
              ? ExactObject<Value, keyof PassthroughRouting>
              : Value
            : Key extends 'ids'
              ? ExactIds<Value>
              : Key extends 'extensions'
                ? NodeType extends 'fragment'
                  ? ExactFragmentExtensions<Value>
                  : Value
                : Value;

/** A fragment's `extensions`, each block checked for unknown keys. */
type ExactFragmentExtensions<Extensions> = {
  [Name in keyof Extensions]: ExactObject<
    Extensions[Name],
    keyof FragmentOverride
  >;
};

/**
 * The template with every node, conditional branch, conditional attribute
 * entry and event checked for keys its type does not define.
 */
type ExactTemplate<Value> = Value extends readonly unknown[]
  ? ExactNodes<Value>
  : ExactNode<Value>;

/**
 * Identity helper that gives template authors compile-time checking and
 * autocompletion. A key a node does not take, such as `style` written beside
 * `tag` instead of inside `attributes`, is a type error at that key, at any
 * depth of the objects written in place. A node held in a value typed as the
 * whole `TemplateNode` union, and an array that mixes such a value in, are
 * checked by validation when the template is processed, not here.
 *
 * @param template - The template definition: a root component node or a
 * bare node array.
 * @returns The template, unchanged.
 *
 * @example
 * export default defineTemplate({
 *   type: 'component',
 *   name: 'Button',
 *   children: [],
 * });
 */
export function defineTemplate<T extends Template>(
  template: T & ExactTemplate<T>
): T {
  return template;
}
