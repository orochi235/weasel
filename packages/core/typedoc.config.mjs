import { packageOptions } from '../../typedoc/packageOptions.mjs';

export default packageOptions(import.meta.dirname, {
  // Types deliberately kept off the public doc surface. Adapter contracts
  // (HitAdapter, ReorderAdapter) are internal composition
  // details — consumers reach them through SceneCanvas, which synthesizes the
  // adapter.
  intentionallyNotExported: [
    'Replacer',
    'Reviver',
    // cubicMath's `{x,y}`. Not surfaced at the root: `Point2` is already the
    // public point type, and `Vec2` is a third spelling of the same shape —
    // consolidating them is a real API decision, not a docs fix.
    'Point',
    'HitAdapter',
    'ReorderAdapter',
    'STANDARD_SLOTS',
    'PenAnchor',
  ],
});
