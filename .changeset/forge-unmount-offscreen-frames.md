---
'@weasel-js/forge': patch
---

forge unmounts a story's frame while its trial is well out of view and reloads
it when the trial comes back, so many canvas-heavy trials open at once no longer
hold every WebGL context the browser allows. The trial keeps the story's config
and state, and the reloaded frame starts from them. A browser without
`IntersectionObserver` keeps every frame mounted, as before.
