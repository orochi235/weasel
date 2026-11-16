---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The kit's paste and drop handlers for images, SVG and copied nodes move to `@weasel-js/editing`, and `ingestPreset` brings them.

This is breaking. A canvas without `ingestPreset` (or `drawPreset`, which includes it) routes a paste or drop through only its own `ingestion.handlers` and its presets'. `ingestion.kitHandlers` now turns off the kit handlers a preset brings, by their `kit:` ids, as before. Core keeps the mechanism: `registerContentHandler`, `runIngest`, `handlersFor`, the `ingestion` prop and dep, and `SceneCanvasApi.ingest`. `KIT_CONTENT_HANDLERS` comes from editing, and `@weasel-js/editing/test-seams` holds the image and SVG measuring stubs a jsdom test needs.

<!-- entry: rank=5 breaking api -->
