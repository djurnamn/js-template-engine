import { TemplateNode } from '../types';
import { BemExtension as BemTypes, Extension, DeepPartial } from '../types/extensions';
interface BemNode extends TemplateNode {
    block?: string;
    element?: string;
    modifiers?: string[];
    modifier?: string;
    ignoreBem?: boolean;
    extensions?: {
        bem?: BemTypes.NodeExtensions;
        [key: string]: any;
    };
}
export declare class BemExtension implements Extension<BemTypes.Options, BemTypes.NodeExtensions> {
    readonly key: "bem";
    private logger;
    constructor(verbose?: boolean);
    setNodeExtensionOptionsShortcut(options: {
        block?: string;
        element?: string;
        modifiers?: string[];
        modifier?: string;
    }): {
        extensions?: {
            bem: BemTypes.NodeExtensions;
        };
    };
    optionsHandler(defaultOptions: BemTypes.Options, options: DeepPartial<BemTypes.Options>): BemTypes.Options;
    nodeHandler(node: BemNode, ancestorNodesContext?: TemplateNode[]): TemplateNode;
    private getBemClasses;
}
export {};
