# ingestion

Getting external content *into* the scene: drop, paste, and file-picker.

## The pipeline

```
DataTransfer / ClipboardData / File[]
        │  itemsFromDataTransfer / itemsFromClipboardData / itemsFromFiles
        ▼
   IngestItem[]                       ← normalized, source-agnostic
        │  runIngest(items, ctx)
        ▼
   registered ContentHandlers         ← first one that claims an item wins
        ▼
   scene ops
```

The normalization step is the point: a PNG dropped from the desktop, pasted
from the clipboard, and chosen from a file picker all arrive at the handlers as
the same `IngestItem`. Handlers never branch on where content came from.

## Handlers

| Handler | Claims |
| --- | --- |
| `kitWeaselJsonHandler` | The kit's own clipboard format — full-fidelity node round-trip. |
| `kitSvgHandler` | SVG files and SVG text (`sniffSvgText` catches markup pasted as a string). |
| `kitImageHandler` | Raster images. |

Registration order matters: the kit's JSON handler is what makes an internal
copy/paste preserve everything rather than degrading to an image, so it must get
first refusal on clipboard content that also carries an image flavor.

`registerContentHandler` is the extension point — register your own to handle a
domain format (a `.dxf`, a CSV that becomes a table) before the kit's fallbacks.

`acquireKitContentHandlers` is refcounted registration for mounted canvases:
several canvases can be mounted at once without registering the kit handlers
several times, and the last unmount cleans up.

## Files

| File | Role |
| --- | --- |
| `ingestItems.ts` | Normalization + `INGEST_STRING_MIMES`. |
| `contentHandlers.ts` | Registry, `runIngest`, `IngestCtx`. |
| `openFilePicker.ts` | Programmatic file picker → the same `IngestItem[]`. |
| `registerKitHandlers.ts` | Refcounted default registration. |
| `*Handler.ts` | The three built-in handlers above. |

## Known gap

`drop` and `paste` shipped without route-grammar gesture names, so bindings of
those kinds are invisible to the Bundle Inspector's route tables (they're
skipped in `SPEC_KIND_TO_GESTURE`). Tracked in `docs/TODO.md` under ingestion
residuals.
