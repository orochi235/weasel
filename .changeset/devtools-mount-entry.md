---
'@weasel-js/devtools': minor
---

`@weasel-js/devtools/mount` gives canvases devtools in development without loading the hook in a production bundle.

`lazyDevtools` is the `devtools` contribution behind a dynamic import of the hook. `DEV_DEVTOOLS` is `[lazyDevtools]` when `isDev()` holds and `[]` otherwise, for an app's provider over bare canvases. `devtoolsOff` withholds devtools from every canvas and shell below where it is provided. `ShellDevtools` is the wrapper `<Lab>`, `EditorShell` and forge's frames use.

```tsx
import { AmbientContributionsProvider } from '@weasel-js/core';
import { DEV_DEVTOOLS, devtoolsOff } from '@weasel-js/devtools/mount';

<AmbientContributionsProvider contributions={DEV_DEVTOOLS}><BareCanvases /></AmbientContributionsProvider>;
<AmbientContributionsProvider contributions={[devtoolsOff]}><AppWithShells /></AmbientContributionsProvider>;
```

<!-- entry: rank=8 new api -->
