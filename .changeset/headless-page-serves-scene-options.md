---
'@weasel-js/headless': major
---

Scenes with registered clips, derivations, compositions or quantize rules render from Node, given to the page with `serveHeadlessPage`.

`@weasel-js/headless/page` no longer starts serving when imported. A custom page script registers what it needs, then calls `serveHeadlessPage` once; `scene` takes `sceneFromJSON`'s options and must match the scenes the host sends:

```ts
// before
registerFont(font);
import '@weasel-js/headless/page';

// after
import { serveHeadlessPage } from '@weasel-js/headless/page';
registerFont(font);
serveHeadlessPage({ scene: { registry, composition, quantize } });
```

A scene naming a registry key the page was not given is refused with an error naming the key and `serveHeadlessPage`. The default page script calls it with no options.

<!-- entry: rank=10 breaking api new -->
