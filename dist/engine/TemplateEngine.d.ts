import { TemplateNode, TemplateOptions } from '../types';
export declare class TemplateEngine {
    private styleProcessor;
    constructor();
    private mergeOptions;
    private applyExtensionOverrides;
    private processStyles;
    private isAttributeValue;
    render(nodes: TemplateNode[], options?: TemplateOptions, isRoot?: boolean, ancestorNodesContext?: TemplateNode[]): Promise<string>;
}
