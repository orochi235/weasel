import { isApplePlatform } from '@weasel-js/gestures';

/** Whether the platform's command modifier is held: Cmd on an Apple platform, Ctrl elsewhere. */
export const modHeld = (e: { metaKey: boolean; ctrlKey: boolean }): boolean => (isApplePlatform() ? e.metaKey : e.ctrlKey);
