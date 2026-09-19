---
'@weasel-js/forge': patch
---

A story file whose meta names no `title` is now titled the way Storybook titles
it: by its path under the directory of the first `stories` glob that matches it,
with `Button/Button.stories.tsx` collapsed to `Button` and a trailing `index` or
`stories` file name dropped. Such a story's id and link now match Storybook's.

Breaking for anyone calling the frame or test entry points directly:
`mountFrame` no longer takes `root`, and each index entry passed to it carries
its `title`; `mountFrame`'s `load` option and `runStory` take the title for a
file whose meta names none in place of the vite root. The `forge()` and
`forgeTest()` plugins pass these for you.
