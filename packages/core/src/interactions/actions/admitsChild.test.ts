import { describe, expect, it } from 'vitest';
import { ON_PAGE, PAGE_A, pagedScene } from 'core/pages/pagedFixture';
import { asNodeId } from 'core/scene/types';
import { childVerdict } from './admitsChild';

function withFollower() {
  const { scene, run } = pagedScene();
  const link = scene.add({
    id: asNodeId('link'), kind: 'mark', layer: 'ink', parent: run, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
    dependsOn: [ON_PAGE],
  });
  return { scene, run, link };
}

describe('childVerdict on the page run', () => {
  it('takes nodes that follow others', () => {
    const { scene, run, link } = withFollower();
    expect(childVerdict(scene, run, [link], undefined)).toBe(true);
  });

  it('refuses anything else, and an insert, whatever canDropInto says', () => {
    const { scene, run, link } = withFollower();
    expect(childVerdict(scene, run, [ON_PAGE], undefined)).toBe(false);
    expect(childVerdict(scene, run, [link, ON_PAGE], () => true)).toBe(false);
    expect(childVerdict(scene, run, [], () => true)).toBe(false);
  });

  it('leaves a page to the ordinary rule', () => {
    const { scene } = withFollower();
    expect(childVerdict(scene, PAGE_A, [ON_PAGE], undefined)).toBe(true);
  });
});
