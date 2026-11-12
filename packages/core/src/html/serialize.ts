import { VOID_ELEMENTS } from '../void-elements';
import { escapeComment } from './escape';
import {
  childSiblingLayout,
  DOCUMENT_SIBLING_LAYOUT,
  joinSiblingLines,
  tagLines,
  textLines,
  type SiblingLayout,
  type SiblingLines,
} from '../sibling-lines';

/**
 * One node of rendered HTML, before it is printed. Both HTML renderers - the
 * annotated reference and the instance render - build these, so the two
 * print markup by the same rules.
 */
export type OutputNode =
  | OutputElement
  | { kind: 'text'; text: string }
  | { kind: 'comment'; text: string }
  | OutputBlock
  | { kind: 'markup'; markup: string };

/**
 * An element. `attributes` are rendered `name="value"` parts, already
 * escaped, in order.
 */
export interface OutputElement {
  kind: 'element';
  tag: string;
  attributes: string[];
  children: OutputNode[];
}

/**
 * Content set between two comments and indented one level inside them:
 * `<!-- component: Row -->` ... `<!-- /component -->`. Without a `close` the
 * opening comment stands alone and `children` is empty.
 */
export interface OutputBlock {
  kind: 'block';
  open: string;
  close?: string;
  children: OutputNode[];
}

const INDENTATION = '  ';

/** The elements whose content keeps its whitespace when rendered. */
const WHITESPACE_PRESERVING_TAGS = new Set(['pre', 'textarea']);

/**
 * Prints output nodes as indented HTML, one node per line.
 *
 * A browser renders the whitespace between two nodes as a space, so no line
 * breaks between them: each break falls inside a tag, before the closing `>`
 * of the node it follows, and text joins its neighbors on one line. Where
 * whitespace between elements never renders - inside an `<svg>` or a table,
 * say - they print one per line as usual.
 * An element whose children are all text, or markup on one line, prints on
 * one line; inside a `<pre>` or `<textarea>`, where a browser keeps every
 * whitespace character, the content prints exactly, with nothing added -
 * except that content beginning with a line break gets one more, since a
 * browser drops the first line break after the opening tag of either.
 * Comment text is escaped so it cannot end the comment early; text and
 * attribute values are printed as given.
 */
export function printNodes(nodes: OutputNode[]): string {
  return printLines(nodes, 0, false, DOCUMENT_SIBLING_LAYOUT).lines.join('\n');
}

function printLines(
  nodes: OutputNode[],
  indent: number,
  preserving: boolean,
  layout: SiblingLayout
): SiblingLines {
  return joinSiblingLines(
    nodes.map((node) => printNode(node, indent, preserving, layout)),
    layout.placement
  );
}

function printNode(
  node: OutputNode,
  indent: number,
  preserving: boolean,
  layout: SiblingLayout
): SiblingLines {
  const indentation = preserving ? '' : INDENTATION.repeat(indent);
  switch (node.kind) {
    case 'text':
      return textLines(indentation, node.text);
    case 'comment':
      return tagLines([commentLine(indentation, node.text)]);
    case 'markup': {
      // Markup passed in whole may begin or end with text.
      const markup = node.markup.trim();
      return {
        lines: node.markup
          .split('\n')
          .map((line) => (line === '' ? line : `${indentation}${line}`)),
        indentation,
        leadingText: markup !== '' && !markup.startsWith('<'),
        trailingText: markup !== '' && !markup.endsWith('>'),
      };
    }
    case 'block':
      if (node.close === undefined) {
        return tagLines([commentLine(indentation, node.open)]);
      }
      return joinSiblingLines(
        [
          tagLines([commentLine(indentation, node.open)]),
          printLines(node.children, indent + 1, preserving, layout),
          tagLines([commentLine(indentation, node.close)]),
        ],
        layout.placement
      );
    case 'element':
      return tagLines(
        printElement(node, indentation, indent, preserving, layout)
      );
  }
}

/** Text, and markup on a single line, print inline with their siblings. */
function isInline(node: OutputNode): boolean {
  return (
    node.kind === 'text' ||
    (node.kind === 'markup' && !node.markup.includes('\n'))
  );
}

function commentLine(indentation: string, text: string): string {
  return `${indentation}<!-- ${escapeComment(text)} -->`;
}

function printElement(
  node: OutputElement,
  indentation: string,
  indent: number,
  preserving: boolean,
  layout: SiblingLayout
): string[] {
  const attributes =
    node.attributes.length > 0 ? ` ${node.attributes.join(' ')}` : '';
  const openTag = `<${node.tag}${attributes}>`;
  if (VOID_ELEMENTS.has(node.tag)) {
    return [`${indentation}${openTag}`];
  }
  const closeTag = `</${node.tag}>`;
  if (node.children.length === 0) {
    return [`${indentation}${openTag}${closeTag}`];
  }
  if (node.children.every(isInline)) {
    const text = node.children
      .map((child) =>
        child.kind === 'text'
          ? child.text
          : child.kind === 'markup'
            ? child.markup
            : ''
      )
      .join('');
    return [
      `${indentation}${openTag}${leadingLineBreak(node, text)}${text}${closeTag}`,
    ];
  }
  if (preserving || WHITESPACE_PRESERVING_TAGS.has(node.tag)) {
    const content = node.children
      .flatMap((child) => printNode(child, 0, true, layout).lines)
      .join('');
    return [
      `${indentation}${openTag}${leadingLineBreak(node, content)}${content}${closeTag}`,
    ];
  }
  const children = childSiblingLayout(node.tag, layout);
  return joinSiblingLines(
    [
      tagLines([`${indentation}${openTag}`]),
      printLines(node.children, indent + 1, false, children),
      tagLines([`${indentation}${closeTag}`]),
    ],
    children.placement
  ).lines;
}

/**
 * The line break added ahead of a `<pre>` or `<textarea>` whose content
 * begins with one: a browser drops the first line break after the opening
 * tag of either, so the content keeps its own only with another before it.
 */
function leadingLineBreak(node: OutputElement, content: string): string {
  return WHITESPACE_PRESERVING_TAGS.has(node.tag) &&
    (content.startsWith('\n') || content.startsWith('\r\n'))
    ? '\n'
    : '';
}
