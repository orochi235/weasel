import { describe, expect, it } from 'vitest';
import { followerHome, keepOnPage, pageForBounds, pageForPoint } from './pagePlacement';
import { ON_PAGE, PAGE_A, PAGE_B, pagedScene } from './pagedFixture';

describe('pageForPoint', () => {
  it('is the page under the point', () => {
    const { scene } = pagedScene();
    expect(pageForPoint(scene, { x: 150, y: 20 })).toBe(PAGE_B);
  });

  it('is the nearer page for a point in the gap, with the pasteboard off', () => {
    const { scene } = pagedScene();
    expect(pageForPoint(scene, { x: 102, y: 20 })).toBe(PAGE_A);
    expect(pageForPoint(scene, { x: 108, y: 20 })).toBe(PAGE_B);
  });

  it('is null for a point in the gap, with the pasteboard on', () => {
    const { scene } = pagedScene({ pasteboard: true });
    expect(pageForPoint(scene, { x: 102, y: 20 })).toBeNull();
  });
});

describe('keepOnPage', () => {
  const page = { x: 0, y: 0, width: 100, height: 50 };

  it('does not shift a box already on the page', () => {
    expect(keepOnPage(page, { x: 10, y: 10, width: 20, height: 10 })).toEqual({ dx: 0, dy: 0 });
  });

  it('brings a box wholly right of the page back by enough to leave 1 unit on it', () => {
    expect(keepOnPage(page, { x: 150, y: 10, width: 20, height: 10 })).toEqual({ dx: -51, dy: 0 });
  });

  it('brings a box above and left of the page back on both axes', () => {
    expect(keepOnPage(page, { x: -40, y: -30, width: 20, height: 10 })).toEqual({ dx: 21, dy: 21 });
  });
});

describe('pageForBounds', () => {
  const gap = { x: 102, y: 10, width: 2, height: 2 };

  it('is the nearer page for a box in the gap, with the pasteboard off', () => {
    expect(pageForBounds(pagedScene().scene, gap)?.id).toBe(PAGE_A);
  });

  it('is null for a box in the gap, with the pasteboard on', () => {
    expect(pageForBounds(pagedScene({ pasteboard: true }).scene, gap)).toBeNull();
  });
});

describe('followerHome', () => {
  it('is the page every node it follows is on, else the run, and null for a node following none', () => {
    const { scene, run } = pagedScene();
    const onB = scene.add({ kind: 'mark', layer: 'ink', parent: PAGE_B, pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    expect(followerHome(scene, { dependsOn: [ON_PAGE] })).toBe(PAGE_A);
    expect(followerHome(scene, { dependsOn: [ON_PAGE, onB] })).toBe(run);
    expect(followerHome(scene, { dependsOn: [ON_PAGE] }, () => PAGE_B)).toBe(PAGE_B);
    expect(followerHome(scene, {})).toBeNull();
  });
});
