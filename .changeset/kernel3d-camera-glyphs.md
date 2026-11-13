---
'@weasel-js/ui': major
'@weasel-js/kernel3d': minor
---

The orbit tool and the camera actions show their own glyphs, drawn by kernel3d in a `kernel3d` namespace that ui's camera glyphs moved to.

`ui:orbit`, `ui:dollyIn`, `ui:dollyOut`, `ui:turnLeft`, `ui:turnRight`, `ui:pitchUp`, `ui:pitchDown`, `ui:rise`, `ui:sink` and `ui:home` are now `kernel3d:` names. An app showing them registers kernel3d's table beside the kit's.

```tsx
// before
<IconRegistryProvider icons={kitIcons}>
// after
import { icons as kernel3dIcons } from '@weasel-js/kernel3d/icons';
<IconRegistryProvider icons={[...kitIcons, kernel3dIcons]}>
```

<!-- entry: breaking new api -->
