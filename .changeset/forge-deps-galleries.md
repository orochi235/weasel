---
"@weasel-js/forge": patch
---

A component's index page lists the listed components it uses and the ones that use it, each linking to that
component's page. The vite plugin derives them from source, following the meta's `component` through imports and
re-exports to the file declaring it, and serves them as `virtual:forge/deps.js`; `mountWorkshop` takes them through
`setDependencies`. A story file tagged `gallery` in its meta's `tags` (or a single story tagged so) is marked in the
sidebar and on its index page, and a component made only of galleries is left out of the lists. `Meta`, `StoryObj`,
`MetaSpec` and `StorySpec` accept `tags`; `IndexContext` adds `Dependencies` and `gallery`.
