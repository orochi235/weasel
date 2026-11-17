---
'@weasel-js/prefs': major
'@weasel-js/prefs-editor': major
---

The set of assets an `AssetEditor` holds is an `AssetSet`, since "workspace" names the area around the page everywhere else in weasel.

`Workspace`, `asWorkspace`, `workspaceCodec` and `workspaceChanges` are `AssetSet`, `asAssetSet`, `assetSetCodec` and `assetSetChanges`, and `AssetEditor`'s `workspace` prop is `assetSet`.

```tsx
// before
<AssetEditor workspace={workspace} original={BASE} onChange={setWorkspace} codec={workspaceCodec([])} />
// after
<AssetEditor assetSet={assetSet} original={BASE} onChange={setAssetSet} codec={assetSetCodec([])} />
```

<!-- entry: breaking api -->
