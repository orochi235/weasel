---
'@weasel-js/labkit': minor
---

`useCaptureDelay` is exported from `@weasel-js/labkit/loupe`, for a readout that captures from a lens's source to wait as the lens does.

It returns a function giving 0 on its first call after a mount and `LENS_REST_MS` after that; a capture effect passes it to its `setTimeout`.

<!-- entry: api -->
