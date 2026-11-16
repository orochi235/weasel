---
'@weasel-js/core': major
---

The devtools hook moved out of core into `@weasel-js/devtools`, and a canvas joins it only when it takes the `devtools` contribution.

This is breaking. `@weasel-js/core/devtools` and `@weasel-js/core/devtools-protocol` are gone, and a dev build no longer installs the hook by itself. The messages, transports and serializer are `@weasel-js/devtools/protocol`; the hook, roots and the `devtools` contribution are `@weasel-js/devtools/hook`. A canvas that does not take `devtools` keeps no devtools root, history record or coord trace.

```tsx
// before: every canvas registered in a dev build; production imported '@weasel-js/core/devtools'
import { createWindowPanelTransport } from '@weasel-js/core/devtools-protocol';

// after
import { AmbientContributionsProvider } from '@weasel-js/core';
import { devtools } from '@weasel-js/devtools/hook';
import { createWindowPanelTransport } from '@weasel-js/devtools/protocol';

<AmbientContributionsProvider contributions={import.meta.env.DEV ? [devtools] : []}>
  <App />
</AmbientContributionsProvider>;
```

A root source built by hand (`createDevtoolsRoot`) reports its own changes through `subscribe(listener(area))`, which replaces `subscribeRegistry`, and hands its probes over as `probes`.

<!-- entry: rank=10 breaking api -->
