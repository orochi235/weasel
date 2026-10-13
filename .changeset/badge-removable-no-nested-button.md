---
'@weasel-js/ui': patch
---

Fixes: a `Badge` with `onRemove` and an action of its own (`onClick`, `href`, or `as="button"`/`as="a"`) rendered its remove `<button>` inside a root `<button>` or `<a>`, which HTML forbids and React warns about.

Breaking for anyone reaching into the markup: the root of such a badge is now a `<span>`, not a `<button>` or `<a>`. It still takes `ref`, `className`, `style`, the `data-*` attributes, and any other DOM props, and still carries `data-focused`. The label inside it is the click target, a `role="button"` element that answers Enter and Space, or a real `<a>` for `href`, and the remove button sits beside it. `aria-label` and `tooltip` go to the label. A selector such as `button[data-status]` or a `ref` typed as `HTMLButtonElement` no longer matches a removable badge; a badge without `onRemove` renders as before.

A removable badge with only a `tooltip` changes the same way: the label is the `role="img"` tooltip trigger, so the remove button is no longer inside an image role.

In the shapes drawn with an SVG outline, the remove control is centered on the label instead of standing on its baseline, and a removable badge is no longer taller than a plain one of the same size.
