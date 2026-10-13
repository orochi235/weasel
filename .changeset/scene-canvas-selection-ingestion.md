---
'@weasel-js/core': patch
---

Breaking: `<SceneCanvas>` no longer takes `actionDefaults`. Nothing had read it since the legacy action bridge was removed.

Fixes: a bare `<SceneCanvas>` registered three sets of pointer and hover media-query listeners. `useDeviceProfile` watched the device even when a `<DeviceProfileProvider>` above it already answered, so every reader under a provider added a set; it now watches nothing under a provider.
