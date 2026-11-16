---
'@weasel-js/core': major
---

Plain-text paste is no longer a kit content handler: `textPreset` brings it, as text-tools' `textContentHandler`.

This is breaking. `kitTextHandler` is gone from core and from `KIT_CONTENT_HANDLERS`, and its id is `'text-tools:text'`, so `ingestion.kitHandlers: { omit: ['kit:text'] }` omits nothing now; leave `textPreset` off, or name the handler in your own list, instead. A canvas without `textPreset` pastes no plain text as a text node.

<!-- entry: breaking behavior -->
