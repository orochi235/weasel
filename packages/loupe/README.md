# @weasel-js/loupe

The magnifier's model, with no surface attached: where it is aimed, how far it
magnifies, whether it is showing re-rendered content or actual pixels, and what
colour it is over.

A **painter** draws it on one kind of surface and answers the few questions the
model asks — does the lens cover this point, what colour is here, repaint. The
painters ship with the surfaces they know: `@weasel-js/hud` draws one into a
WebGL canvas, `@weasel-js/labkit` draws one over a lab's own content.

```ts
import { createLoupeModel } from '@weasel-js/loupe';

const loupe = createLoupeModel({ surface, factor: 8 });
loupe.aimAt({ x, y });
```
