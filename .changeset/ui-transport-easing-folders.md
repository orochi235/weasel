---
'@weasel-js/ui': major
---

`Transport` and `EasingPicker` move out of the `components/Timeline` subpath into subpaths of their own.

The `Timeline` subpath now holds the timeline alone: `Timeline`, `AnimatedTimeline`, `TimeRuler`, and the time-scale helpers. `AnimatedTransport` is in the `Transport` subpath, and the root barrel still exports all of them.

```ts
// before
import { EasingPicker, Transport } from '@weasel-js/ui/components/Timeline';
// after
import { Transport } from '@weasel-js/ui/components/Transport';
import { EasingPicker } from '@weasel-js/ui/components/EasingPicker';
```

<!-- entry: breaking api -->
