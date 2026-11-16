/** Part of the `@weasel-js/core` barrel. Converting outlines and strokes to paths, and telling the user when it fails. */

// ─── Create Outlines and Outline Stroke: outlines and strokes to path geometry ───────────────────────────
export {
  applyCreateOutlines,
  applyOutlineStroke,
  strokeCovers,
  strokeRegion,
  useCreateOutlinesAdapter,
} from '../interactions/actions/outlines';
export { warnUser, warnOutlines } from '../interactions/actions/notices';
export { useNotices } from '../interactions/actions/useNotices';
export type { NoticesDep, NoticeOptions } from '../interactions/actions/notices';
export type {
  CreateOutlinesAdapter,
  CreateOutlinesResult,
  OutlinePathSpec,
  OutlineStrokeResult,
  StrokeRegionOptions,
} from '../interactions/actions/outlines';
