import { TemplateNode } from '@js-template-engine/core';
import { ReactExtension as ReactTypes, Extension, DeepPartial } from '@js-template-engine/core';
interface ReactNode extends TemplateNode {
    extensions?: {
        react?: ReactTypes.NodeExtensions;
        [key: string]: any;
    };
    tag?: string;
    attributes?: Record<string, any>;
    expressionAttributes?: Record<string, any>;
}
export declare class ReactExtension implements Extension<ReactTypes.Options, ReactTypes.NodeExtensions> {
    readonly key: "react";
    private logger;
    constructor(verbose?: boolean);
    private sanitizeComponentName;
    optionsHandler(defaultOptions: ReactTypes.Options, options: DeepPartial<ReactTypes.Options>): ReactTypes.Options;
    nodeHandler(node: ReactNode): TemplateNode;
    rootHandler(htmlContent: string, options: ReactTypes.Options): string;
}
export {};
