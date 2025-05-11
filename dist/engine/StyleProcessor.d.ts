import { TemplateNode, TemplateOptions } from '../types';
export declare class StyleProcessor {
    private logger;
    private processedStyles;
    constructor(verbose?: boolean);
    processNode(node: TemplateNode): void;
    hasStyles(): boolean;
    private getSelector;
    generateOutput(options: TemplateOptions): string;
    private generateInlineStyles;
    private generateCss;
    private generateScss;
    private camelToKebab;
    getInlineStyles(node: TemplateNode): string | null;
}
