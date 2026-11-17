# @weasel-js/paint-kinds

The registry of the kinds a weasel `Paint` can be.

`Paint` is a closed union whose `kind` names a registered entry. Solid, the three gradients, the tile patterns,
image and texture are built in, mesh loads on first use, and a consumer adds its own kind with `registerPaintKind`.
An entry carries the renderer's draw slots, which the same call registers with `@weasel-js/renderer`, and what an
editor and a serializer read: its label and glyph, the paint it seeds from a color, its editor, its stops, and its
SVG.

```ts
import { getPaintKind, registerPaintKind, withPaintKind } from '@weasel-js/paint-kinds';
import { usePaintKinds } from '@weasel-js/paint-kinds/react';
```

The glyphs naming each kind, and the `none` and `inherit` paint states, are in the `paint-kinds` icon namespace:
`@weasel-js/paint-kinds/icons` is the table.
