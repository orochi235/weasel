import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GestureRoute, gestureRouteSegments } from './GestureRoute';
import * as PkgRoot from '../../index';

const texts = (route: string) =>
  gestureRouteSegments(route).map((seg) => (typeof seg.text === 'string' ? seg.text : '<node>'));

describe('gestureRouteSegments', () => {
  it('orders phase, gesture, modifiers, target', () => {
    expect(texts('[initial] drag => node +mod ?shift')).toEqual(['initial', 'drag', expect.stringMatching(/^\+.+\?.+$/), 'node']);
  });

  it('splits a channel off its phase, and leaves out the implicit channel', () => {
    expect(texts('[rect:engaged] click => handle').slice(0, 2)).toEqual(['rect', 'engaged']);
    expect(texts('[engaged] click => handle')[0]).toBe('engaged');
  });

  it('leaves out the target for a gesture that has none', () => {
    expect(texts('[initial] keyDown(Escape)')).toHaveLength(2);
  });

  it('chevrons every segment but the last', () => {
    const caps = gestureRouteSegments('[initial] click => handle +shift').map((seg) => seg.endCap);
    expect(caps).toEqual(['chevron', 'chevron', 'chevron', undefined]);
  });
});

describe('GestureRoute', () => {
  it('draws one badge per segment, labeled with the route', () => {
    const route = '[initial] drag => node +shift';
    const { container } = render(<GestureRoute route={route} />);
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(4);
    expect(container.firstElementChild?.getAttribute('aria-label')).toBe(route);
  });

  it('is exported from the package root', () => {
    expect(PkgRoot.GestureRoute).toBe(GestureRoute);
  });
});
