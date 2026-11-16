---
'@weasel-js/ui-input': major
'@weasel-js/gestures': minor
---

`chordKey`, `codeLetter`, `CHORD_MODIFIERS` and `ChordSource` moved from `@weasel-js/ui-input` to `@weasel-js/gestures`; they are unchanged.

`@weasel-js/gestures` already exported `CHORD_MODIFIERS`; it now also exports `chordKey`, `codeLetter` and the `ChordSource` type.

```ts
// before
import { chordKey, codeLetter, type ChordSource } from '@weasel-js/ui-input';
// after
import { chordKey, codeLetter, type ChordSource } from '@weasel-js/gestures';
```

<!-- entry: breaking api -->
