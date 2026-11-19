import { prefersReducedMotion } from '@weasel-js/react';

/** How long a kit animation takes when its options name no duration: none where the reader asked for less motion. */
export const defaultMotionMs = (): number => (prefersReducedMotion() ? 0 : 200);
