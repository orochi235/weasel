/**
 * @weasel-js/paint-kinds — the registry of the kinds a `Paint` can be.
 *
 * `Paint` is a closed union whose `kind` names a registered entry: solid, the
 * three gradients, the tile patterns, image and texture are built in, mesh
 * loads on first use, and a consumer registers its own with
 * `registerPaintKind`. An entry carries the renderer's draw slots, which it
 * registers with `@weasel-js/renderer` in the same call, and what an editor
 * and a serializer read: its label and glyph, the paint it seeds from a color,
 * its editor, its stops, and its SVG. The React hooks that list the kinds are
 * `@weasel-js/paint-kinds/react`.
 *
 * @packageDocumentation
 */
export {
  getPaintKind, listGradientKinds, listPaintKinds, paintKindOf, paintKindRegistry, patternFamily,
  registerPaintKind, registerPaintKindLoader, seedTile, switchGradientKind,
} from './paintKinds';
export type { PaintKindLoader } from './paintKinds';
export { asPaint } from './paintKindEntry';
export type { PaintKind, PaintKindEditorProps, PaintKindEntry, PaintKindFamily } from './paintKindEntry';
export type { PaintKindsIconName } from './icons.gen';
