import { describe, expect, it, vi } from 'vitest';
import type { IngestItem } from '@weasel-js/routing';
import { UNKNOWN_MIME } from '@weasel-js/gestures';
import type { ContentHandlerEntry } from './contentHandlers';
import { ghostBounds, previewIngest } from './ghost';

const pending = (kind: 'file' | 'string', mime: string): IngestItem =>
  ({ pending: kind, mime }) as unknown as IngestItem;

const handler = (match: string | string[]): ContentHandlerEntry => ({ id: `t:${match}`, match, handle: () => {} });
const IMAGES_AND_TEXT = [handler('image/*'), handler('text/plain')];

// 600 × 1200 world units visible: the shorter side is 600, so a file's ghost is 100 square.
const at = (point: { x: number; y: number } | null = { x: 500, y: 500 }) => ({
  point, viewportWorldRect: () => ({ x: 0, y: 0, width: 1200, height: 600 }),
});

describe('ghostBounds', () => {
  it('gives each claimable file a square centered on the point, cascading', () => {
    const boxes = ghostBounds([pending('file', 'image/png'), pending('file', 'image/jpeg')], at(), IMAGES_AND_TEXT);
    expect(boxes).toEqual([
      { x: 450, y: 450, width: 100, height: 100 },
      { x: 474, y: 474, width: 100, height: 100 },
    ]);
  });

  it('skips a file no handler could claim, and keeps one whose type is not known yet', () => {
    const boxes = ghostBounds(
      [pending('file', 'application/pdf'), pending('file', UNKNOWN_MIME)], at(), IMAGES_AND_TEXT,
    );
    expect(boxes).toHaveLength(1);
  });

  it('gives a drag of strings one line-shaped box, however many flavors it has', () => {
    const boxes = ghostBounds([pending('string', 'text/plain'), pending('string', 'text/html')], at(), IMAGES_AND_TEXT);
    expect(boxes).toEqual([{ x: 400, y: 487.5, width: 200, height: 25 }]);
  });

  it('shows only the files when strings ride beside them', () => {
    const boxes = ghostBounds([pending('file', 'image/png'), pending('string', 'text/plain')], at(), IMAGES_AND_TEXT);
    expect(boxes).toEqual([{ x: 450, y: 450, width: 100, height: 100 }]);
  });

  it('centers on the viewport without a point, and shows nothing nobody could claim', () => {
    expect(ghostBounds([pending('file', 'image/png')], at(null), IMAGES_AND_TEXT))
      .toEqual([{ x: 550, y: 250, width: 100, height: 100 }]);
    expect(ghostBounds([pending('string', 'text/csv')], at(), IMAGES_AND_TEXT)).toEqual([]);
  });
});

describe('previewIngest', () => {
  const deps = () => {
    const hide = vi.fn();
    const show = vi.fn(() => hide);
    return {
      hide, show,
      deps: { ingestion: { viewportWorldRect: () => ({ x: 0, y: 0, width: 1200, height: 600 }) }, previewPaths: { show } },
    };
  };

  it('draws the ghost at the drop point and hands back what takes it down', () => {
    const d = deps();
    const stop = previewIngest(d.deps, { items: [pending('file', 'image/png')], worldX: 500, worldY: 500 }, IMAGES_AND_TEXT);
    expect(d.show).toHaveBeenCalledWith([{ path: { kind: 'rect', x: 450, y: 450, width: 100, height: 100 } }]);
    stop?.();
    expect(d.hide).toHaveBeenCalledTimes(1);
  });

  it('draws nothing for a drag nothing could claim, or with no items', () => {
    const d = deps();
    expect(previewIngest(d.deps, { items: [pending('string', 'text/csv')] }, IMAGES_AND_TEXT)).toBeUndefined();
    expect(previewIngest(d.deps, undefined, IMAGES_AND_TEXT)).toBeUndefined();
    expect(d.show).not.toHaveBeenCalled();
  });
});
