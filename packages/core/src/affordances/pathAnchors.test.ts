/** Which paths' anchors take a press: the selected ones, and the path being edited even when it is not selected itself
 *  — a hidden path edited through the effect that is. */
import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import type { ChromeState } from 'core/selection/chromeState';
import { createPathAnchorAffordances } from './pathAnchors';

const LINE = pathFromD('M0 0 L100 0');
const regionIds = (editingId: string | null, selection: string[]) => {
  const [, , anchors] = createPathAnchorAffordances(() => ({ editingId, getPose: (id) => (id === 'p' ? LINE : null) }));
  return anchors!.regions({ selection } as unknown as ChromeState).map((r) => r.id);
};

describe('createPathAnchorAffordances', () => {
  it("offers a selected path's anchors", () => {
    expect(regionIds(null, ['p'])).toEqual(['p:anchor:0', 'p:anchor:1']);
  });

  it('offers the edited path\'s anchors though the selection holds the effect it is edited through', () => {
    expect(regionIds('p', ['fx'])).toEqual(['p:anchor:0', 'p:anchor:1']);
  });

  it('offers nothing for a path neither selected nor edited', () => {
    expect(regionIds(null, ['fx'])).toEqual([]);
  });
});
