// Registers the kind for any import of this subpath, which is why core's
// package.json lists this entry and `register` under `sideEffects`.
import '../core/paint/registerMesh';

export * from 'renderer/meshPaint';
