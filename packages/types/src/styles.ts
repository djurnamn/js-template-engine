export type StyleOutputFormat = 'inline' | 'css' | 'scss';

export interface StyleDefinition {
  [key: string]: string | number | boolean | Record<string, string | number> | undefined;
} 