import { packageOptions } from '../../typedoc/packageOptions.mjs';

export default packageOptions(import.meta.dirname, {
  // Every subpath is built from a shim; see `entries.ts`.
  sourceOf: (key) => (key === '.' ? undefined : `src/import-shims/${key.slice(2)}.ts`),
  // Types deliberately kept off the public doc surface. Adapter contracts
  // (HitAdapter, ReorderAdapter, CanvasAdapter) are internal composition
  // details — consumers reach them through SceneCanvas, which synthesizes the
  // adapter.
  intentionallyNotExported: [
    'CanvasAdapter',
    'Replacer',
    'Reviver',
    // cubicMath's `{x,y}`. Not surfaced at the root: `Point2` is already the
    // public point type, and `Vec2` is a third spelling of the same shape —
    // consolidating them is a real API decision, not a docs fix.
    'Point',
    'HandScratch',
    'HitAdapter',
    'BooleanZOrder',
    'ReorderAdapter',
    'CreateDebugOverlayLayerOpts',
    'STANDARD_SLOTS',
    'PenAnchor',
  ],
});
