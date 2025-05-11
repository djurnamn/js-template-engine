"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TemplateEngine_1 = require("../engine/TemplateEngine");
const verbose = true;
const templateEngine = new TemplateEngine_1.TemplateEngine();
const cardTemplate = [
    {
        tag: 'div',
        attributes: {
            class: 'card',
        },
        children: [
            {
                tag: 'div',
                attributes: {
                    class: 'card-header',
                },
                children: [
                    {
                        type: 'slot',
                        name: 'header',
                    },
                ],
            },
            {
                tag: 'div',
                attributes: {
                    class: 'card-content',
                },
                children: [
                    {
                        type: 'slot',
                        name: 'content',
                    },
                ],
            },
            {
                tag: 'div',
                attributes: {
                    class: 'card-footer',
                },
                children: [
                    {
                        type: 'slot',
                        name: 'footer',
                    },
                ],
            },
        ],
    },
];
const slots = {
    header: [
        {
            tag: 'h2',
            children: [
                {
                    type: 'text',
                    content: 'Card Title',
                },
            ],
        },
    ],
    content: [
        {
            tag: 'p',
            children: [
                {
                    type: 'text',
                    content: 'This is the main content of the card.',
                },
            ],
        },
    ],
    footer: [
        {
            tag: 'button',
            children: [
                {
                    type: 'text',
                    content: 'Read More',
                },
            ],
        },
    ],
};
// Render
(async () => {
    await templateEngine.render(cardTemplate, {
        name: 'card',
        slots,
        writeOutputFile: true,
        verbose,
    });
})();
