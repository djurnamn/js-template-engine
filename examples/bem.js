// Example of using the TemplateEngine class to render a simple HTML template with a class naming convention using the BEM extension.
// You can run this example with `npm run example:slots` or `yarn example:slots`.

const { TemplateEngine, BemExtension } = require("../src");
const verbose = true;

const templateEngine = new TemplateEngine();
const bemExtension = new BemExtension(verbose);

const bem = bemExtension.setNodeExtensionOptionsShortcut;

/*
Using the BEM extension options shortcut allows us to write:

{
  tag: "nav",
  ...bem({ block: "nav" }),
}

instead of:

{
  tag: "nav",
  extensions: {
    bem: {
      block: "nav",
    },
  },
}
*/

// Data
const navigationItems = [
  { name: "Home", url: "/", iconName: "home" },
  { name: "About", url: "/about", iconName: "about" },
];

// Templates
const navigationTemplate = [
  {
    tag: "nav",
    ...bem({ block: "nav" }),
    children: [
      {
        tag: "ul",
        ...bem({ element: "list" }),
        children: navigationItems.map((item, itemIndex) => ({
          tag: "li",
          ...bem({
            element: "item",
            modifiers: itemIndex === 0 ? ["active"] : [],
          }),
          children: [
            {
              tag: "a",
              ...bem({ element: "link" }),
              attributes: { href: item.url },
              children: [
                {
                  tag: "span",
                  ...bem({ element: "link-text" }),
                  children: [{ type: "text", content: item.name }],
                },
              ],
            },
          ],
        })),
      },
    ],
  },
];

// Render
(async () => {
  await templateEngine.render(navigationTemplate, {
    name: "bem",
    extensions: [bemExtension], // Only BEM extension is needed for this example
    writeOutputFile: true,
    verbose,
  });
})();
