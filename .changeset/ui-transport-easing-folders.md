---
'@weasel-js/ui': major
---

`Transport`, `AnimatedTransport`, and `EasingPicker` move out of the `components/Timeline` subpath into subpaths of their own.

The `Timeline` subpath now holds the timeline alone: `Timeline`, `AnimatedTimeline`, `TimeRuler`, and the time-scale helpers. The root barrel still exports all of them.

```ts
// before
import { AnimatedTransport, EasingPicker, Transport } from '@weasel-js/ui/components/Timeline';
// after
import { AnimatedTransport, Transport } from '@weasel-js/ui/components/Transport';
import { EasingPicker } from '@weasel-js/ui/components/EasingPicker';
```

<!-- entry: breaking api -->
