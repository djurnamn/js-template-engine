import { TemplateNode, TemplateOptions } from './index';
import { StyleDefinition } from './styles';
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type WithRequired<T, K extends keyof T> = T & {
    [P in K]-?: T[P];
};
export type ExtensionKey = 'react' | 'bem' | string;
export interface BaseExtensionOptions extends TemplateOptions {
}
export declare namespace ReactExtension {
    interface Options extends BaseExtensionOptions {
        componentName?: string;
        importStatements?: string[];
        exportType?: 'default' | 'named';
        propsInterface?: string;
        props?: string;
    }
    interface NodeExtensions {
        ignore?: boolean;
        tag?: string;
        attributes?: Record<string, string | number | boolean>;
        expressionAttributes?: Record<string, string>;
    }
}
export declare namespace BemExtension {
    interface Options extends BaseExtensionOptions {
        prefix?: string;
        separator?: {
            element?: string;
            modifier?: string;
        };
    }
    interface NodeExtensions {
        ignore?: boolean;
        block?: string;
        element?: string;
        modifier?: string;
        modifiers?: string[];
    }
}
export interface ExtensionOptions<T extends BaseExtensionOptions = BaseExtensionOptions> {
    options: DeepPartial<T>;
}
export interface NodeExtensions<T extends Record<string, any> = Record<string, any>> {
    extensions?: {
        [K in ExtensionKey]?: T;
    };
}
export interface ExtendedTemplateNode extends TemplateNode {
    extensions?: {
        react?: ReactExtension.NodeExtensions;
        bem?: BemExtension.NodeExtensions;
        [key: ExtensionKey]: Record<string, any> | undefined;
    };
}
export interface Extension<T extends BaseExtensionOptions = BaseExtensionOptions, U extends Record<string, any> = Record<string, any>> {
    key: ExtensionKey;
    optionsHandler?: (defaultOptions: T, options: DeepPartial<T>) => T;
    nodeHandler: (node: TemplateNode & NodeExtensions<U>, ancestorNodesContext?: TemplateNode[]) => TemplateNode;
    rootHandler?: (template: string, options: T) => string;
}
export declare function isExtensionOptions<T extends BaseExtensionOptions>(value: unknown): value is T;
export declare function hasNodeExtensions<T extends Record<string, any>>(node: TemplateNode, key: ExtensionKey): node is TemplateNode & {
    extensions: {
        [K in typeof key]: T;
    };
};
export interface StyleProcessorPlugin {
    onProcessNode?: (node: TemplateNode, selector: string) => string | void;
    generateStyles?: (styles: Map<string, StyleDefinition>, options: TemplateOptions, originalTemplateTree?: TemplateNode[]) => string | null;
}
