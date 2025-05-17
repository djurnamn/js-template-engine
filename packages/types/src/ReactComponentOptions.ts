export interface ReactComponentOptions {
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, string>;
  [key: string]: any;
} 