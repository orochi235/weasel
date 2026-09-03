/**
 * `useTiledSurface` was built, exported and tested, but nothing mounted a
 * `SurfaceContext` in production — so `useSurfaceOptional()` always answered
 * null and a tile registered from inside a trial reached nothing.
 *
 * The surface is anchored to `.lk-lab__body` rather than wrapped around the
 * workspace: `.lk-lab__body > .lk-workspace { min-width: 0 }` is a direct-child
 * selector, so an extra element between them silently drops that rule.
 */
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { useSurfaceOptional, useSurfaceTile } from '../surface/useSurfaceTile';
import { Lab } from './Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let seen: SurfaceHandle | null | 'not-rendered' = 'not-rendered';

function Probe() {
  seen = useSurfaceOptional();
  const tile = useSurfaceTile('pane');
  return <div data-testid="pane" ref={tile} />;
}

const probeInstrument = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Probe',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Probe />,
});

describe('<Lab> surface provider', () => {
  it('puts a surface handle in reach of an instrument', () => {
    seen = 'not-rendered';
    render(<Lab instruments={[probeInstrument]} defaultInstrument="Probe" />);
    expect(seen).not.toBe('not-rendered');
    expect(seen).not.toBeNull();
    expect(typeof (seen as unknown as SurfaceHandle).registerTile).toBe('function');
  });

  it('keeps the workspace a direct child of the lab body', () => {
    // The min-width:0 rule that keeps the flex row from overflowing is
    // `.lk-lab__body > .lk-workspace`. An element inserted between them drops
    // it, and jsdom cannot see the overflow that follows.
    const { container } = render(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />,
    );
    const body = container.querySelector('.lk-lab__body');
    expect(body).not.toBeNull();
    expect(body?.querySelector(':scope > .lk-workspace')).not.toBeNull();
  });
});
