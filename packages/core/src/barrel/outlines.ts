/**
 * Part of the `@weasel-js/core` barrel. Stroking a path into a region, and telling the user when a conversion fails.
 *
 * @packageDocumentation
 */

export { strokeRegion, type StrokeRegionOptions } from '../domains/paths/strokeRegion';
export { warnUser, warnOutlines } from '../interactions/actions/notices';
export { useNotices } from '../interactions/actions/useNotices';
export type { NoticesDep, NoticeOptions } from '../interactions/actions/notices';
