---
"@weasel-js/core": patch
---

Core now depends on `@msb235/blits` 0.8.1, up from 0.7.0. The pin is exact, so an app that also installs blits itself gets one copy only when it names the same version.

Nothing in core's own API changes. blits 0.8.0 is a breaking release for code that calls blits directly: `seek` rebuilds a voice's state, a history store's `cut` takes a `seq`, and the deprecated `hold`, `period`, and `hex()` are gone. Its changelog has the full list.
