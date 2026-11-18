---
'@weasel-js/core': major
---

Core no longer re-exports the text engine: import it from `@weasel-js/text`, and DOM editing from `@weasel-js/text-dom`.

This is breaking. Names such as `TextStyle`, `StyledRun`, `layoutRuns`, `measureText`, `bakeTextFit`, `renderLabel`, `isTextData`, `textToPath`, `loadTextOutlines` and `TextOutlinesError` come from `@weasel-js/text`; `useTextEdit`, `runsToDom`, `domToRuns` and `StyleToggle` from `@weasel-js/text-dom`. `textCommand` and its siblings stay on core, beside the renderer's other draw-command builders.

```ts
// before
import { type TextStyle, measureText } from '@weasel-js/core';
// after
import { type TextStyle, measureText } from '@weasel-js/text';
```

<!-- entry: rank=10 breaking api -->
