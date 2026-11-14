---
'@weasel-js/ui': major
---

`FunctionLayerConfig` and `KeyframeLayerConfig` are now `FunctionLayerOptions` and `KeyframeLayerOptions`.

They are the options bags of `createFunctionLayer` and `createKeyframeLayer`.

```ts
// before
import type { FunctionLayerConfig, KeyframeLayerConfig } from '@weasel-js/ui';
// after
import type { FunctionLayerOptions, KeyframeLayerOptions } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
