---
'@weasel-js/forge': minor
---

A meta's `id` names its file's story ids in place of its title, as in Storybook: `{ title: 'Example/Page', id: 'custom' }` gives `custom--logged-in`.

`loadStories` takes the index entry's `metaId` as a fourth argument, and `runStory` as the `metaId` option.

<!-- entry: new api -->
