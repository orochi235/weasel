---
'@weasel-js/storage': patch
'@weasel-js/loupe': patch
'@weasel-js/p-touch': patch
---

Fixes from a bug audit of the storage, loupe and P-touch packages.

- `createIndexedDbAdapter` now creates its `store` in a database that already exists without it, by upgrading the database one version, so two adapters can keep separate stores in one database (the default `'weasel'` included). It also opens a database some other code has taken past version 1, which used to fail with a `VersionError` and leave every read and write rejected. The upgrade waits, as any IndexedDB upgrade does, until other connections to the database close; this adapter's own connections close for it.
- A captured `CanvasSource` read after its canvas grew answers `null` for a point past the last captured frame, instead of the pixel the previous read left behind.
- `writeLbx` and `sceneToLbx` place `lbxObjects` inside a rect clip whose width or height is negative, which they used to skip as cut by the clip.
