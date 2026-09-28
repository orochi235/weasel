// Registers the kind for any import of this subpath, which is why core's
// package.json lists this entry and `register` under `sideEffects`.
import '../features/meshPaint/register';

export * from '../features/meshPaint';
