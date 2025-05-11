import { TemplateNode, TemplateOptions, TemplateExtension } from '../types';
export declare class TemplateEngine {
    private styleProcessor;
    private extensions;
    constructor(extensions?: TemplateExtension[]);
    private mergeOptions;
    private applyExtensionOverrides;
    private processStyles;
    private isAttributeValue;
    private renderAttributes;
    render(nodes: TemplateNode[], options?: TemplateOptions, isRoot?: boolean, ancestorNodesContext?: TemplateNode[]): Promise<string>;
}
