import type { PhaseSpec } from '@weasel-js/gestures';

/**
 * The binding phase that holds a binding off while a gesture is in flight on
 * any channel. The keys that edit the document carry it, so one pressed
 * mid-drag cannot change what the drag is moving; so do the bindings that
 * would swap the tool out from under a drag.
 */
export const BETWEEN_GESTURES: PhaseSpec = [{ channel: '*', phase: 'initial' }];
