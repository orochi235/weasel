import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { deleteAnchorsAt, editAnchorSet } from './anchorEdits';
import { pathToAnchors } from './anchors';

/** An open three-anchor line, then a lone point. */
const lineAndPoint = (n = 3) => {
  const b = new PathBuilder().moveTo(0, 0);
  for (let i = 1; i < n; i++) b.lineTo(10 * i, 0);
  return b.moveTo(50, 50).build();
};

describe('deleteAnchorsAt', () => {
  it('keeps a lone point the deletion did not touch', () => {
    const out = editAnchorSet(lineAndPoint(), (set) => deleteAnchorsAt(set, [1]))!;
    expect(pathToAnchors(out).anchors.map((sub) => sub.map((a) => a.x))).toEqual([[0, 20], [50]]);
  });

  it('deletes down to a lone point that survives it', () => {
    const out = editAnchorSet(lineAndPoint(2), (set) => deleteAnchorsAt(set, [1]))!;
    expect(pathToAnchors(out).anchors.map((sub) => sub.map((a) => a.x))).toEqual([[50]]);
  });

  it('refuses a deletion that leaves nothing', () => {
    const set = pathToAnchors(new PathBuilder().moveTo(0, 0).lineTo(10, 0).build());
    expect(deleteAnchorsAt(set, [1])).toBe(false);
  });
});
