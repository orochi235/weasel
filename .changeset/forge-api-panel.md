---
'@weasel-js/forge': patch
---

An index page shows its component's API beside the stories: every prop with its type, whether it is required, its default and its JSDoc, and what the component's `ref` takes, a handle's methods and properties listed. Props from React's and TypeScript's own types are counted per declaring type rather than listed. It is read through the project's TypeScript when the story module is served. The plugin takes `api: false` to turn it off, and a custom index page places it with `IndexContext.Api`.

The prop reader now reads a typed meta's `component` from the object as written, so `const meta: Meta = { component: Chip }` gives the same controls as an untyped meta.
