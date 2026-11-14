---
'@weasel-js/ui': major
---

`SelectionPanel`, `AnchorFields`, and `CharacterOptions` move under `@weasel-js/ui/components/inspector/`.

The three panels that read and edit the live scene (the selection, its anchors, and the text tool) now sit together. Their exports are unchanged, and the root barrel exports them as before.

```ts
// before
import { SelectionPanel } from '@weasel-js/ui/components/SelectionPanel';
import { AnchorFields } from '@weasel-js/ui/components/AnchorFields';
import { CharacterOptions } from '@weasel-js/ui/components/CharacterOptions';
// after
import { SelectionPanel } from '@weasel-js/ui/components/inspector/SelectionPanel';
import { AnchorFields } from '@weasel-js/ui/components/inspector/AnchorFields';
import { CharacterOptions } from '@weasel-js/ui/components/inspector/CharacterOptions';
```

<!-- entry: breaking api -->
