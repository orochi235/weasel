---
'@weasel-js/forge': patch
---

An index page's API panel reads TypeDoc's JSON where a build has written one.

- The new `typedoc` option names the JSON (default `dist/typedoc.json`, relative to the vite root) and, through `href`, the address of each export's API reference page. `false` reads none.
- Where TypeDoc documents the component, the panel shows its comments with `{@link}` resolved and `@remarks` and `@see` added, where a prop or ref member is inherited from, every overload of a ref method, and a link to the component's reference page.
- The prop list, types and defaults still come from the component's TypeScript types, so an edit shows at once. A component whose files changed after the JSON was written, or that TypeDoc does not document, is read from its types alone, as before.
