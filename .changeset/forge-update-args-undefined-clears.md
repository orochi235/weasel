---
'@weasel-js/forge': patch
---

`updateArgs({ key: undefined })` in a CSF story clears the arg, as Storybook does, instead of putting the story's own value back.

<!-- entry: fix -->
