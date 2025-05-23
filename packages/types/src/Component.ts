import type { TemplateNode } from './index';

export interface Component {
  name?: string;
  props?: Record<string, string>;
  script?: string;
  imports?: (string | { from: string; imports: string[] })[];
  extensions?: Record<string, any>;
  typescript?: boolean;
}

export interface RootHandlerContext {
  component?: Component;
  styleOutput?: string;
  [key: string]: any;
}

export interface ComponentOptions {
  name?: string;
  componentName?: string;
}

export function resolveComponentName(
  context: RootHandlerContext,
  options: ComponentOptions,
  defaultName = 'Component'
): string {
  const component = context.component;
  return component?.name || options.name || options.componentName || defaultName;
}

export function resolveComponentProps(component?: Component): string {
  if (!component?.props) return '';
  return `  props: {\n    ` +
    Object.entries(component.props)
      .map(([k, v]) => `${k}: ${v}`)
      .join(',\n    ') +
    `\n  },`;
}

export function resolveComponentImports(
  component?: Component,
  defaultImports: (string | { from: string; imports: string[] })[] = []
): (string | { from: string; imports: string[] })[] {
  return [
    ...(component?.imports || []),
    ...defaultImports,
  ];
}
