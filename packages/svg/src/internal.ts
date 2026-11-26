/**
 * @weasel-js/svg/internal — the reading of a clip that svg's animated writers share, for
 * `@weasel-js/lottie` to write the same way. Not public API: it changes without notice.
 *
 * @packageDocumentation
 */
export { lottieTangentsOf, numText, rounded } from './animate/easing';
export {
  createWarnOnce, nodeKindsIn, planClip, strokeLossWarning, strokelessTrimWarning, type ClipFormat, type ClipPlan, type Frame, type PlannedTrack, type Warn,
} from './animate/plan';
export { trimEdgesOf } from './animate/trim';
