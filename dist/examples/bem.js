"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TemplateEngine_1 = require("../engine/TemplateEngine");
const bem_1 = require("../extensions/bem");
const verbose = true;
const templateEngine = new TemplateEngine_1.TemplateEngine();
const bemExtension = new bem_1.BemExtension(verbose);
const breadcrumbsTemplate = [
    {
        tag: 'nav',
        extensions: {
            bem: {
                block: 'breadcrumbs',
            },
        },
        children: [
            {
                tag: 'ul',
                extensions: {
                    bem: {
                        element: 'list',
                    },
                },
                children: [
                    {
                        tag: 'li',
                        extensions: {
                            bem: {
                                element: 'item',
                            },
                        },
                        children: [
                            {
                                tag: 'a',
                                extensions: {
                                    bem: {
                                        element: 'text',
                                    },
                                },
                                attributes: {
                                    href: '/',
                                },
                                children: [
                                    {
                                        type: 'text',
                                        content: 'Home',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        tag: 'li',
                        extensions: {
                            bem: {
                                element: 'item',
                                modifier: 'current',
                            },
                        },
                        children: [
                            {
                                tag: 'span',
                                extensions: {
                                    bem: {
                                        element: 'text',
                                    },
                                },
                                children: [
                                    {
                                        type: 'text',
                                        content: 'About',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
];
// Render
(async () => {
    await templateEngine.render(breadcrumbsTemplate, {
        name: 'breadcrumbs',
        extensions: [bemExtension],
        writeOutputFile: true,
        verbose,
    });
})();
