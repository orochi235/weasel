---
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

Every component in forge now has an index page, and stories open faster.

An index page is listed first under each component in the sidebar and shows all
of the component's stories in one frame, each at its defaults and then once per
value of each boolean and enum control. A component supplies its own page with
a native meta's `index`, or `parameters.forge.index` in a CSF file; either is
handed the stories and the generated page's parts (`IndexContext`). The sidebar
opens on the Components view.

The workshop keeps two frame documents loaded ahead of need and moves one into
a trial with `moveBefore`, so opening a story loads only the story's own
modules. Frames now ask for their port with a hello message, and the handoff
names what to show. `FrameSetup.prepare` is awaited before a story first
renders, for imports only some stories need. `@weasel-js/labkit/config` no
longer loads `@weasel-js/ui` at runtime.
