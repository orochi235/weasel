---
"@weasel-js/diagram": minor
---

`readEffectDoc` checks an `EffectDoc` read from a file, refusing one with a wrong-typed field with an `EffectDocShapeError`.

```ts
import { readEffectDoc } from '@weasel-js/diagram/effect';

const doc = readEffectDoc(JSON.parse(text)); // throws "Not an effect document: doc.pipeline.stages[0] is not an object"
```

<!-- entry: api -->
