export interface StyleDefinition {
    [key: string]: string | number | Record<string, string | number>;
}
export type StyleOutputFormat = 'inline' | 'css' | 'scss';
export interface StyleProcessingOptions {
    styles: {
        outputFormat: StyleOutputFormat;
        generateSourceMap?: boolean;
        minify?: boolean;
    };
}
export interface TemplateStyleOptions {
    styles?: {
        outputFormat?: StyleOutputFormat;
        generateSourceMap?: boolean;
        minify?: boolean;
    };
}
