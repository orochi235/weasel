---
'@weasel-js/forge': patch
---

forge: a CSF story gets a control for each prop of its meta's `component`, read from the component's TypeScript types. A boolean, string, or number prop gets its control, and a union of string literals gets a select; a prop's doc comment becomes the control's description. Props declared inside `node_modules` are left out, and so is every prop on a story whose `render` takes no args. The story's own `args` and `argTypes` still apply over what was read. This needs `typescript` installed, now an optional peer dependency; `propControls: false` on the `forge` vite plugin turns it off.
