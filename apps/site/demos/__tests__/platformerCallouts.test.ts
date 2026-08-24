// apps/site/demos/__tests__/platformerCallouts.test.ts
import { describe, it, expect } from 'vitest';
import { calloutAge, calloutScreenPos, pushCallout, stepCallouts, type Callout } from '../platformer/callouts';
import type { View } from '@weasel-js/core';

const VIEW: View = { x: 10, y: 20, scale: { x: 2, y: 2 } };
const DIMS = { width: 720, height: 405 };

describe('pushCallout', () => {
  it('appends without mutating the input list', () => {
    const list: Callout[] = [];
    const c: Callout = { text: 'ow', anchor: { kind: 'screen' }, bornAt: 0, ttl: 1 };
    const next = pushCallout(list, c);
    expect(list).toHaveLength(0);
    expect(next).toEqual([c]);
  });

  it('preserves push order', () => {
    const a: Callout = { text: 'first', anchor: { kind: 'screen' }, bornAt: 0, ttl: 1 };
    const b: Callout = { text: 'second', anchor: { kind: 'screen' }, bornAt: 0.1, ttl: 1 };
    const list = pushCallout(pushCallout([], a), b);
    expect(list.map((c) => c.text)).toEqual(['first', 'second']);
  });
});

describe('stepCallouts', () => {
  const a: Callout = { text: 'a', anchor: { kind: 'screen' }, bornAt: 0, ttl: 1 };
  const b: Callout = { text: 'b', anchor: { kind: 'screen' }, bornAt: 0.5, ttl: 1 };

  it('keeps callouts whose ttl has not elapsed', () => {
    expect(stepCallouts([a, b], 0.9)).toEqual([a, b]);
  });

  it('drops a callout once now - bornAt reaches its ttl', () => {
    expect(stepCallouts([a, b], 1.0)).toEqual([b]);
  });

  it('drops every expired callout, keeping only the survivors in order', () => {
    expect(stepCallouts([a, b], 1.6)).toEqual([]);
  });
});

describe('calloutScreenPos', () => {
  it('projects a world-anchored callout through the camera view', () => {
    const c: Callout = { text: 'ow', anchor: { kind: 'world', at: { x: 50, y: 60 } }, bornAt: 0, ttl: 1 };
    expect(calloutScreenPos(c, VIEW, DIMS)).toEqual({ x: (50 - 10) * 2, y: (60 - 20) * 2 });
  });

  it('ignores the camera for a screen-anchored callout, centering on the canvas', () => {
    const c: Callout = { text: 'FREE HEALTHCARE', anchor: { kind: 'screen' }, bornAt: 0, ttl: 1 };
    expect(calloutScreenPos(c, VIEW, DIMS)).toEqual({ x: DIMS.width / 2, y: DIMS.height / 2 });

    const movedView: View = { x: 999, y: -500, scale: { x: 5, y: 5 } };
    expect(calloutScreenPos(c, movedView, DIMS)).toEqual({ x: DIMS.width / 2, y: DIMS.height / 2 });
  });
});

describe('calloutAge', () => {
  const c: Callout = { text: 'ow', anchor: { kind: 'screen' }, bornAt: 1, ttl: 2 };

  it('is 0 at birth', () => {
    expect(calloutAge(c, 1)).toBe(0);
  });

  it('is 1 at expiry and clamps past it', () => {
    expect(calloutAge(c, 3)).toBe(1);
    expect(calloutAge(c, 10)).toBe(1);
  });

  it('interpolates linearly between birth and expiry', () => {
    expect(calloutAge(c, 2)).toBeCloseTo(0.5, 5);
  });
});
