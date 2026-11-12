/**
 * The printed lines of one node, or of several sibling nodes joined, with
 * whether authored text sits at either end.
 */
export interface SiblingLines {
  lines: string[];
  /** The indentation the first line begins with, before its content. */
  indentation: string;
  /** True when the first line begins with authored text. */
  leadingText: boolean;
  /** True when the last line ends with authored text. */
  trailingText: boolean;
}

/**
 * Where a line break may fall between two sibling nodes that are not text:
 *
 * - `between-tags` - anywhere: the target drops whitespace holding a line
 *   break between them (JSX, Vue's whitespace condensing).
 * - `inside-tags` - only inside a tag: the target keeps that whitespace as a
 *   rendered space (Svelte, plain HTML), so the line breaks before the
 *   previous node's closing `>` or `/>` instead, and where that node ends in
 *   no tag (a comment, a block) the two join on one line.
 */
export type LineBreakPlacement = 'between-tags' | 'inside-tags';

/**
 * How an element's children are laid out: where a line break may fall
 * between them, and whether they sit inside an `<svg>`.
 */
export interface SiblingLayout {
  placement: LineBreakPlacement;
  insideSvg: boolean;
}

/** The layout of nodes outside any element: whitespace between them renders. */
export const DOCUMENT_SIBLING_LAYOUT: SiblingLayout = {
  placement: 'inside-tags',
  insideSvg: false,
};

/**
 * The elements whose children a browser lays out with no box for the
 * whitespace between them, so it never renders there.
 */
const WHITESPACE_IGNORING_TAGS = new Set([
  'colgroup',
  'datalist',
  'select',
  'table',
  'tbody',
  'tfoot',
  'thead',
  'tr',
]);

/**
 * The layout of an element's children, from the element's tag and the layout
 * it sits in. Whitespace between elements renders nowhere inside an `<svg>`
 * outside its `<text>` and `<foreignObject>`, nor between the children of a
 * table, its row groups and rows, a `<colgroup>`, a `<select>` or a
 * `<datalist>`, so a line break may fall anywhere there; elsewhere it falls
 * inside a tag.
 *
 * @param tag - The element's tag; a tag known only at runtime passes
 * `undefined`.
 * @param parent - The layout the element sits in.
 * @returns The layout of the element's children.
 */
export function childSiblingLayout(
  tag: string | undefined,
  parent: SiblingLayout
): SiblingLayout {
  const insideSvg =
    tag === 'svg' ||
    (parent.insideSvg && tag !== 'text' && tag !== 'foreignObject');
  return {
    placement:
      insideSvg || (tag !== undefined && WHITESPACE_IGNORING_TAGS.has(tag))
        ? 'between-tags'
        : 'inside-tags',
    insideSvg,
  };
}

/**
 * Lines that hold no authored text at either end, so the first line's
 * leading whitespace is all indentation.
 */
export function tagLines(lines: string[]): SiblingLines {
  return {
    lines,
    indentation: /^\s*/.exec(lines[0] ?? '')![0],
    leadingText: false,
    trailingText: false,
  };
}

/**
 * The line of one text node: the indentation, then the text exactly as
 * written.
 */
export function textLines(indentation: string, text: string): SiblingLines {
  return {
    lines: [`${indentation}${text}`],
    indentation,
    leadingText: true,
    trailingText: true,
  };
}

/**
 * Joins the printed lines of sibling nodes so that indentation never renders
 * as whitespace: authored text joins its neighbors on one line, keeping its
 * spacing exactly as written, and between other nodes the line breaks where
 * `placement` allows.
 *
 * @param parts - The siblings' lines, in order.
 * @param placement - Where a break may fall between two non-text siblings.
 * @returns The joined lines.
 * @example
 * joinSiblingLines(
 *   [tagLines(['  <b>a</b>']), tagLines(['  <i>b</i>'])],
 *   'inside-tags'
 * ).lines; // ['  <b>a</b', '  ><i>b</i>']
 */
export function joinSiblingLines(
  parts: SiblingLines[],
  placement: LineBreakPlacement
): SiblingLines {
  const lines: string[] = [];
  let indentation = '';
  let leadingText = false;
  let trailingText = false;
  for (const part of parts) {
    if (part.lines.length === 0) {
      continue;
    }
    if (lines.length === 0) {
      lines.push(...part.lines);
      indentation = part.indentation;
      leadingText = part.leadingText;
      trailingText = part.trailingText;
      continue;
    }
    const previous = lines.pop()!;
    const [first, ...rest] = part.lines;
    const content = first.slice(part.indentation.length);
    const tagEnd = trailingText ? undefined : closingTagEnd(previous);
    if (trailingText || part.leadingText) {
      lines.push(`${previous}${content}`, ...rest);
    } else if (placement === 'between-tags') {
      lines.push(previous, first, ...rest);
    } else if (tagEnd === undefined) {
      lines.push(`${previous}${content}`, ...rest);
    } else {
      const kept = previous.slice(0, -tagEnd.length).trimEnd();
      // A closing `>` alone on its line moves whole, leaving no line behind.
      if (kept.trim() !== '') {
        lines.push(kept);
      }
      lines.push(`${part.indentation}${tagEnd}${content}`, ...rest);
    }
    trailingText = part.trailingText;
  }
  return { lines, indentation, leadingText, trailingText };
}

/**
 * The `>` or `/>` that ends a line closing a tag, which a line break can move
 * in front of; none for a line ending in a comment, a block or text.
 */
function closingTagEnd(line: string): string | undefined {
  if (line.endsWith('-->')) {
    return undefined;
  }
  if (line.endsWith('/>')) {
    return '/>';
  }
  return line.endsWith('>') ? '>' : undefined;
}
