---
'@weasel-js/forge': patch
---

A native story now always runs under its index entry's title. When the plugin could not tell that a meta was forge's — its import, or `@weasel-js/forge` itself, resolved to nothing from the story file — the index titled the story by its path while the loaded module used the meta's `title`, so a link written from one named no story in the other. `loadStories` and `loadNativeModule` treat their title argument as the index entry's, and a native meta's own `title` no longer overrides it; a CSF meta's still does. `forgeTest` passes the indexed title to `runStory` likewise.

The plugin also re-reads a story file when a module it imports from first appears, so a helper that re-exports forge's `meta` and is created after the story file now retitles that story without an edit to the story file.
