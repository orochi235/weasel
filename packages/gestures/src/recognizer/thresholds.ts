/**
 * The times and distances that tell one pointer gesture from another. The
 * drag threshold sits with its helper in `ui/dragThreshold.ts`.
 */

/** How long a touch or pen press is held before it fires `longPress`, in ms. */
export const LONG_PRESS_MS = 500;

/** The longest gap between two clicks that still makes a double click, in ms:
 *  the upper end of OS double-click settings. */
export const DOUBLE_CLICK_MAX_MS = 600;

/** How far apart, in CSS pixels, two clicks may land and still make a double
 *  click: the drift of a real mouse or trackpad between them. */
export const DOUBLE_CLICK_MAX_PX = 8;

/** How far, in CSS pixels, a finger or the centroid of a multitouch gesture
 *  may travel before the gesture stops being a tap. */
export const TAP_THRESHOLD_PX = 8;
