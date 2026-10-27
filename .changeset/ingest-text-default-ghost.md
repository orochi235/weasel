---
'@weasel-js/core': patch
---

A canvas with the `ingest` feature now turns pasted or dropped plain text into a text node by default: `kitTextHandler` is registered with the other kit handlers, and passing it in `ingestion.handlers` is no longer needed. A string that arrives beside a file is passed over, since there it is the file's name or URL (a browser dragging an image, the OS copying a file); for this `IngestCtx` gains optional `items`, every item the arrival carried.

While an OS drag hovers, `ingest` previews it: a placeholder box per file some handler could claim, or one line-shaped box for a drag of text, where the drop would put it, at a size fixed against the viewport. A browser withholds a hovering drag's contents and size, so the box shows where, not what.
