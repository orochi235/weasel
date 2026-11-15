---
'@weasel-js/core': major
'@weasel-js/pdf': major
'@weasel-js/svg': major
---

PNG, PDF and SVG exports draw one revision of the document, pages and bounds included, even when it is edited while fonts or pictures load.

Each export now reads through `captureExport(scene, regions, { warm, read })`: an edit while it loads starts it again, and after `EXPORT_CAPTURE_ATTEMPTS` tries it rejects with `ExportRevisionError`. Regions may be a function of the document, read again each attempt; `exportPages` places its pages so, by id, and fails for a page the document no longer holds. `ExportFormat.export` is handed these `ExportRegions`, so a format of your own reads them through `captureExport` or `exportRegionsOf`:

```ts
// before
export: async (scene, regions, opts) => write(scene, regions[0]!)
// after
export: (scene, regions, opts) => captureExport(scene, regions, {
  warm: (doc, [region]) => warmWhatItNeeds(doc, region!),
  read: (doc, [region]) => write(doc, region!),
})
```

<!-- entry: rank=5 breaking api fix -->
