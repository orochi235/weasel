import type { Scene } from './types';

/** A scene of any payload, layers and pose: what a reader that inspects none of the three takes. */
export type AnyScene = Scene<unknown, string, unknown>;
