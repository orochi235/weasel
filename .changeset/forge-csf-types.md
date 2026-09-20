---
'@weasel-js/forge': patch
---

forge types its own CSF. `Meta`, `StoryObj`, `ArgsOf`, `CsfDecorator`,
`CsfStoryContext`, `CsfPlayContext`, `CsfStep` and `ArgType` are exported from
the package root, describing the annotations forge's loader actually reads — so
a CSF file is typed by the tool that renders it and needs no Storybook install.
They are deliberately narrower than Storybook's: a field forge ignores is not
in them.

New `@weasel-js/forge/play` carries what a `play` function asserts with:
`expect` (chai with `@vitest/expect`'s jest-style matchers), and testing-library's
`within`, `screen`, `waitFor` and `userEvent`. A play runs inside the story's
frame, which cannot import `vitest` — that entry only exists inside a test
worker. No jest-dom matchers: they install through `expect.extend`, which wants
matcher state no frame has; assert on the DOM directly instead.

The Storybook shim plugin now answers for `storybook/test` as well as
`storybook/preview-api`, so third-party CSF written against either keeps
resolving.
