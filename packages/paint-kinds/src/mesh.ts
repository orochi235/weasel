/**
 * @weasel-js/paint-kinds/mesh — importing it registers the `mesh-gradient`
 * kind at once, where the registry otherwise loads it on first use. It is the
 * one module of this package with a side effect, which is why the manifest
 * lists it under `sideEffects`.
 *
 * @packageDocumentation
 */
import { registerPaintKind } from './paintKinds';
import { meshGradientKind } from './meshKind';

registerPaintKind(meshGradientKind);

export { meshGradientKind };
