// Example of using the TemplateEngine class to render a simple HTML template with slots.
// You can run this example with `npm run example:slots` or `yarn example:slots`.

const { TemplateEngine } = require("../src");
const verbose = true;

const templateEngine = new TemplateEngine();

// Data
const stylesheetEntries = [
  { href: "style.css", rel: "stylesheet" },
  { href: "theme.css", rel: "stylesheet" },
];

const scriptEntries = [
  { src: "app.js", defer: true },
  { src: "analytics.js", async: true },
];

// Templates
const htmlTemplate = [
  {
    tag: "html",
    attributes: {
      lang: "en",
    },
    children: [
      {
        tag: "head",
        children: [
          {
            tag: "meta",
            attributes: {
              charset: "UTF-8",
            },
          },
          {
            tag: "title",
            children: [
              {
                type: "text",
                content: "Hello, World!",
              },
            ],
          },
          {
            type: "slot",
            name: "head-end",
          },
        ],
      },
      {
        tag: "body",
        children: [
          {
            type: "slot",
            name: "body-beginning",
          },
          {
            tag: "h1",
            attributes: {
              class: "title",
            },
            children: [
              {
                type: "text",
                content: "Hello, World!",
              },
            ],
          },
          {
            type: "slot",
            name: "body-end",
          },
        ],
      },
    ],
  },
];

// Template formatting functions
const stylesheets = stylesheetEntries.map((stylesheetEntry) => ({
  tag: "link",
  attributes: { ...stylesheetEntry },
}));

const scripts = scriptEntries.map((script) => ({
  tag: "script",
  attributes: { ...script },
}));

// Render
(async () => {
  await templateEngine.render(htmlTemplate, {
    name: "slots",
    slots: {
      "head-end": stylesheets,
      "body-end": scripts,
    },
    writeOutputFile: true,
    verbose,
  });
})();
