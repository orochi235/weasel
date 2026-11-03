import { describe, expect, it } from 'vitest';
import { ON_PAGE, PAGE_A, PAGE_B, pagedScene } from 'core/pages/pagedFixture';
import { asNodeId, type NodeId } from 'core/scene/types';
import { childVerdict } from './admitsChild';

const R2 = asNodeId('r2');

/** `ON_PAGE` on page a, `r2` on page b, `link` in the run following both, and `near` on page a following
 *  only `ON_PAGE`. */
function withFollower() {
  const { scene, run } = pagedScene();
  scene.add({ id: R2, kind: 'mark', layer: 'ink', parent: PAGE_B, pose: { x: 5, y: 5, width: 5, height: 5 }, data: {} });
  const follower = (id: string, parent: NodeId, dependsOn: NodeId[]) => scene.add({
    id: asNodeId(id), kind: 'mark', layer: 'ink', parent, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {}, dependsOn,
  });
  const link = follower('link', run, [ON_PAGE, R2]);
  const near = follower('near', PAGE_A, [ON_PAGE]);
  return { scene, run, link, near };
}

describe('childVerdict on the page run', () => {
  it('takes nodes that follow others across pages', () => {
    const { scene, run, link } = withFollower();
    expect(childVerdict(scene, run, [link], undefined)).toBe(true);
  });

  it('refuses a follower whose nodes are all on one page, anything else, and an insert', () => {
    const { scene, run, link, near } = withFollower();
    expect(childVerdict(scene, run, [near], undefined)).toBe(false);
    expect(childVerdict(scene, run, [ON_PAGE], undefined)).toBe(false);
    expect(childVerdict(scene, run, [link, ON_PAGE], () => true)).toBe(false);
    expect(childVerdict(scene, run, [], () => true)).toBe(false);
  });
});

describe('childVerdict on a page', () => {
  it('leaves content to the ordinary rule', () => {
    const { scene } = withFollower();
    expect(childVerdict(scene, PAGE_A, [ON_PAGE], undefined)).toBe(true);
  });

  it('takes a follower only when everything it follows is on that page, or lands there with it', () => {
    const { scene, link, near } = withFollower();
    expect(childVerdict(scene, PAGE_A, [near], undefined)).toBe(true);
    expect(childVerdict(scene, PAGE_B, [near], undefined)).toBe(false);
    expect(childVerdict(scene, PAGE_B, [near, ON_PAGE], undefined)).toBe(true);
    expect(childVerdict(scene, PAGE_A, [link], undefined)).toBe(false);
  });
});
