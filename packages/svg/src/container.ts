/**
 * `@container` size queries, answered against one container of a known size.
 *
 * A parse lays nothing out, so the only box it knows the size of is the root
 * `<svg>`'s: the viewport the media environment already carries.
 */

import { DEFAULT_MEDIA_ENVIRONMENT, evaluateMediaQuery, type SvgMediaEnvironment } from './media';

/** An element that declared itself a size container, and its box. */
export interface QueryContainer {
  readonly names: readonly string[];
  /** `inline-size` answers queries on the inline axis alone. */
  readonly type: 'size' | 'inline-size';
  readonly width: number;
  readonly height: number;
}

/**
 * The size container the root is, sized by `media`'s viewport, or `null` when
 * its `container-type` (or the `container` shorthand's) is not `size` or
 * `inline-size`. `declared` reads a cascaded property of the root; a longhand
 * wins over the shorthand wherever each was set.
 */
export function queryContainerOf(
  declared: (prop: string) => string | undefined, media: SvgMediaEnvironment,
): QueryContainer | null {
  const [shortNames, shortType] = (declared('container') ?? '').split('/').map((part) => part.trim());
  const type = (declared('container-type') ?? shortType ?? '').trim().toLowerCase();
  if (type !== 'size' && type !== 'inline-size') return null;
  const names = (declared('container-name') ?? shortNames ?? '').trim().split(/\s+/)
    .filter((n) => n !== '' && n.toLowerCase() !== 'none');
  return { names, type, width: media.width, height: media.height };
}

const NAME = /^(-?[a-zA-Z_\u0080-￿][\w\u0080-￿-]*)(?![\w(-])\s*/;
/** Features of the block axis, which an `inline-size` container cannot answer. */
const BLOCK_AXIS = /\b(?:height|block-size|aspect-ratio|orientation)\b/;
/** Media features a container is never asked: evaluating them would answer for the device. */
const NOT_A_SIZE_FEATURE = /\b(?:device-|resolution|color|monochrome|prefers-|update|hover|pointer)/;

/**
 * Whether one `@container` prelude, `[<name>] <condition>`, holds for
 * `container`. A named query needs the container to declare that name. The
 * condition takes the size features (`width`, `height`, `inline-size`,
 * `block-size`, `aspect-ratio`, `orientation`) in either syntax; a style
 * query, or anything else it cannot answer, does not hold.
 */
export function containerQueryHolds(prelude: string, container: QueryContainer | null): boolean {
  if (!container) return false;
  let condition = prelude.trim();
  const named = NAME.exec(condition);
  if (named && named[1].toLowerCase() !== 'not') {
    if (!container.names.includes(named[1])) return false;
    condition = condition.slice(named[0].length);
  }
  condition = condition.toLowerCase();
  if (NOT_A_SIZE_FEATURE.test(condition)) return false;
  if (container.type === 'inline-size' && BLOCK_AXIS.test(condition)) return false;
  // SVG text runs horizontally, so the inline axis is the width.
  const physical = condition.replace(/\binline-size\b/g, 'width').replace(/\bblock-size\b/g, 'height');
  return evaluateMediaQuery(physical, {
    ...DEFAULT_MEDIA_ENVIRONMENT, width: container.width, height: container.height,
  });
}
