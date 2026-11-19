---
'@weasel-js/forge': minor
---

`runStory` takes `globals` to render and play a story under, and a `check` that runs on the story host before it unmounts.

`@weasel-js/forge/test` also exports `runAxe`, which takes `off`, the axe rules to leave out, and `loadStories`, to list a story file's stories.

```ts
await runStory(mod, 'Default', file, title, {
  globals: { mode: 'dark' },
  check: async (host) => expect((await runAxe(host, { page: false })).violations).toEqual([]),
});
```

<!-- entry: new api -->
