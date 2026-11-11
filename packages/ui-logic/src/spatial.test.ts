import { describe, expect, it } from 'vitest';
import { headingCost, headingOf, nearestToward, type Heading } from './spatial';

const box = (x: number, y: number) => ({ x, y, width: 10, height: 10 });
const HERE = box(100, 100);

describe('headingOf', () => {
  it('reads the arrows and nothing else', () => {
    expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].map(headingOf))
      .toEqual(['left', 'right', 'up', 'down', null]);
  });
});

describe('headingCost', () => {
  it('is the travel along the heading plus twice the drift across it', () => {
    expect(headingCost(HERE, box(150, 100), 'right')).toBe(50);
    expect(headingCost(HERE, box(150, 120), 'right')).toBe(90);
    expect(headingCost(HERE, box(120, 40), 'up')).toBe(100);
  });
  it('is null for a target behind or level', () => {
    expect(headingCost(HERE, box(50, 100), 'right')).toBeNull();
    expect(headingCost(HERE, box(100, 200), 'right')).toBeNull();
    expect(headingCost(HERE, HERE, 'down')).toBeNull();
  });
  it('takes the cost of drift from its caller', () => {
    expect(headingCost(HERE, box(150, 120), 'right', 0)).toBe(50);
  });
  it('costs the same mirrored onto every heading', () => {
    const mirrored: [Heading, ReturnType<typeof box>][] = [
      ['right', box(130, 110)], ['left', box(70, 110)], ['down', box(110, 130)], ['up', box(110, 70)],
    ];
    for (const [heading, to] of mirrored) expect(headingCost(HERE, to, heading)).toBe(50);
  });
});

describe('nearestToward', () => {
  it('prefers a target straight ahead over a nearer one off to the side', () => {
    expect(nearestToward(HERE, [box(130, 140), box(160, 100)], 'right')).toBe(1);
  });
  it('passes over targets behind, and ones with no box', () => {
    expect(nearestToward(HERE, [box(20, 100), null, box(300, 100), undefined], 'right')).toBe(2);
  });
  it('is -1 with nothing ahead', () => {
    expect(nearestToward(HERE, [box(20, 100), HERE], 'right')).toBe(-1);
    expect(nearestToward(HERE, [], 'up')).toBe(-1);
  });
  it('keeps the earlier of two that tie', () => {
    expect(nearestToward(HERE, [box(150, 110), box(150, 90)], 'right')).toBe(0);
  });
});
