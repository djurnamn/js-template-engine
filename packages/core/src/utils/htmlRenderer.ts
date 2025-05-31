import type { TemplateNode } from '@js-template-engine/types';

function renderAttributes(attributes: Record<string, any> = {}): string {
  const renderedAttrs = Object.entries(attributes)
    .map(([key, value]) => {
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') {
        // Handle style objects
        if (key === 'style') {
          const styleString = Object.entries(value)
            .map(([styleKey, styleValue]) => {
              // Convert camelCase to kebab-case for CSS properties
              const cssKey = styleKey.replace(/([A-Z])/g, '-$1').toLowerCase();
              return `${cssKey}: ${styleValue}`;
            })
            .join('; ');
          return `style="${styleString}"`;
        }
        return '';
      }
      return `${key}="${value}"`;
    })
    .filter(Boolean);

  return renderedAttrs.length > 0 ? ' ' + renderedAttrs.join(' ') : '';
}

function renderNode(node: TemplateNode): string {
  if (node.type === 'text') {
    return node.content || '';
  }

  if (node.type === 'element' || !node.type) {
    const tag = node.tag || 'div';
    const attributes = renderAttributes(node.attributes);
    const children = node.children?.map(child => renderNode(child)).join('') || '';

    if (node.selfClosing) {
      return `<${tag}${attributes}/>`;
    }

    return `<${tag}${attributes}>${children}</${tag}>`;
  }

  return '';
}

export function renderToHtml(nodes: TemplateNode[]): string {
  return nodes.map(node => renderNode(node)).join('');
} 