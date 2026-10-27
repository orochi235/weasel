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
| `kitTextHandler` | Plain text, as a text node sized to the string. Passes over strings that arrive beside a file, which describe it. |

Registration order matters: the kit's JSON handler is what makes an internal
copy/paste preserve everything rather than degrading to an image, so it must get
first refusal on clipboard content that also carries an image flavor.

A drag still in flight shows its MIMEs and no contents, so the canvas cannot put
it to a predicate `match`. It asks `couldClaim` instead, which reads globs and a
predicate handler's declared `types`, and refuses the drag when no handler could
take it. A predicate handler with no `types` might take anything, so while one is
registered no drag is refused.

While a drag hovers, the dispatcher asks the action its drop would run for its
`Action.preview`, with the drag's pending items (`pendingKindOf` tells a file
from a string) and the world point. `ingest` answers with a ghost
(`ghost.ts`): a box per file some handler could claim, or one line-shaped box
for the strings, placed as `placement.ts` would place them, drawn through the
`previewPaths` dep.

`registerContentHandler` is the extension point — register your own to handle a
domain format (a `.dxf`, a CSV that becomes a table) before the kit's fallbacks.

A drop or paste keeps the string flavors in `INGEST_STRING_MIMES` and drops the
rest, except any exact MIME a registered handler names in `match` or `types`:
those are admitted for as long as the handler stays registered
(`admitIngestMime` in `@weasel-js/routing`). So a drag from the app's own UI can
carry its payload under a type of its own, as weaselchart's Shapes panel does.

`acquireKitContentHandlers` is refcounted registration for mounted canvases:
several canvases can be mounted at once without registering the kit handlers
several times, and the last unmount cleans up.

## Files

Normalization, `INGEST_STRING_MIMES`, and `admitIngestMime` live in
`packages/routing/src/ingestion/ingestItems.ts`, since the dispatcher
materializes items before any handler is asked.

| File | Role |
| --- | --- |
| `contentHandlers.ts` | Registry, `runIngest`, `IngestCtx`. |
| `openFilePicker.ts` | Programmatic file picker → the same `IngestItem[]`. |
| `registerKitHandlers.ts` | Refcounted default registration. |
| `placement.ts` | Where arriving content lands: on the point or the viewport center, cascading. |
| `ghost.ts` | What a drag in flight would land as, for `ingest`'s preview. |
| `*Handler.ts` | The built-in handlers above. |
