---
'@weasel-js/forge': patch
---

A story in the workshop no longer loses its state on the first press. That press focuses the trial, which re-renders the lab, and forge called the story's `render` again each time; a story declaring a component inside `render` got a new component type and remounted, so the Dialog story's "Open dialog" opened nothing and the first edit in a story was dropped. `render` now runs again only when the story's config, state or globals change, as in Storybook.
