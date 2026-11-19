---
'@weasel-js/core': major
---

Plain-text paste is no longer a kit content handler: `textTools.text` brings it, as text-tools' `textContentHandler`.

This is breaking. `kitTextHandler` is gone from core and from `KIT_CONTENT_HANDLERS`, and its id is `'text-tools:text'`, so `ingestion.kitHandlers: { omit: ['kit:text'] }` omits nothing now; leave `textTools.text` off, or name the handler in your own list, instead. A canvas without `textTools.text` pastes no plain text as a text node.

<!-- entry: breaking behavior -->
