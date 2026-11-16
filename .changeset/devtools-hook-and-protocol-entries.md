---
'@weasel-js/devtools': minor
---

`@weasel-js/devtools/hook` puts a page's canvases in a panel's view, and `@weasel-js/devtools/protocol` carries the messages between them.

`devtools` is a contribution: every canvas below `<AmbientContributionsProvider contributions={[devtools]}>`, or one given `ambient={[devtools]}`, registers with the hook on `window.__weaselDevtools__`, which the first installs. `/hook` also has `attachDevtools`, `installDevtoolsHook`, `createDevtoolsHook` and `createDevtoolsRoot`. `/protocol` has the message types and guards, the in-page and window transports, and `serialize`, and loads neither React nor core, so an extension's background and content scripts import it.

<!-- entry: rank=8 new api -->
