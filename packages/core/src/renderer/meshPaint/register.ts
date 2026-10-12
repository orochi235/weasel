/** Registers the mesh-gradient kind at import; `@weasel-js/core/mesh` imports it for effect. */
import { registerPaintKind } from 'renderer/paintKinds';
import { meshGradientKind } from './meshPaint';

registerPaintKind(meshGradientKind);
