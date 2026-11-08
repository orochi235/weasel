---
'@weasel-js/storage': patch
'@weasel-js/loupe': patch
'@weasel-js/p-touch': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
---

Fixes from a bug audit of the storage, loupe, P-touch, hud and labkit packages.

- `createIndexedDbAdapter` now creates its `store` in a database that already exists without it, by upgrading the database one version, so two adapters can keep separate stores in one database (the default `'weasel'` included). It also opens a database some other code has taken past version 1, which used to fail with a `VersionError` and leave every read and write rejected. The upgrade waits, as any IndexedDB upgrade does, until other connections to the database close; this adapter's own connections close for it.
- A captured `CanvasSource` read after its canvas grew answers `null` for a point past the last captured frame, instead of the pixel the previous read left behind.
- `writeLbx` and `sceneToLbx` place `lbxObjects` inside a rect clip whose width or height is negative, which they used to skip as cut by the clip.
- A loupe aimed where nothing is drawn now reports no color: `color` becomes `null` and `onColorChange` is called with `null`, where it used to keep showing the last color it read. Its readout then matches what an eyedropper click there takes, which is nothing. Breaking for TypeScript callers: `onColorChange` is typed `(hex: string | null) => void` on `createLoupeModel`, hud's `createLoupe` and `LoupeEvents`, and labkit's loupe options, so a handler typed for `string` alone needs widening.
