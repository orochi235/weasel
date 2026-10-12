/** Registers the mesh-gradient kind at import; `@weasel-js/core/mesh` imports it for effect. */
import { registerPaintKind } from './paintKinds';
import { meshGradientKind } from './meshKind';

registerPaintKind(meshGradientKind);
