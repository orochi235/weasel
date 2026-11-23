---
'@weasel-js/forge': major
---

Story ids now match Storybook's for multi-word exports: `LoggedIn` under `Example/Page` is `example-page--logged-in`, not `example-page--loggedin`.

Links, bookmarks and anything else holding the id of a story whose export name has more than one word change with it. Single-word exports keep their ids.

```ts
// before
'draw-commandbar--emptydocument'
// after
'draw-commandbar--empty-document'
```

<!-- entry: breaking fix data -->
