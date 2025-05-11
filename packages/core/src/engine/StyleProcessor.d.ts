import { TemplateNode, TemplateOptions } from '../types';
import { StyleProcessorPlugin } from '../types/extensions';
export declare class StyleProcessor {
    private logger;
    private processedStyles;
    private plugins;
    constructor(verbose?: boolean, plugins?: StyleProcessorPlugin[]);
    processNode(node: TemplateNode): void;
    private mergeStyleDefinitions;
    hasStyles(): boolean;
    private getSelector;
    generateOutput(options: TemplateOptions, originalTemplateTree?: TemplateNode[]): string;
    private generateInlineStyles;
    private generateCss;
    private generateScss;
    private camelToKebab;
    getInlineStyles(node: TemplateNode): string | null;
}
