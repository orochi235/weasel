import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Powerline } from './Powerline';
import { Badge } from '../Badge';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import * as PkgRoot from '../../index';

function fills(caps: (EdgeCap | undefined)[]) {
  const { container, unmount } = render(
    <Powerline variant="solid">
      {caps.map((cap, i) => <Badge key={i} endCap={cap}>{`s${i}`}</Badge>)}
    </Powerline>,
  );
  const ds = [...container.querySelectorAll('.badge-fill')].map((path) => path.getAttribute('d'));
  unmount();
  return ds;
}

describe('Powerline', () => {
  it('draws each child badge on the powerline base', () => {
    const { container } = render(
      <Powerline>
        <Badge>a</Badge>
        <Badge>b</Badge>
        <Badge>c</Badge>
      </Powerline>,
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(3);
  });

  it('exposes a labeled row as a named group, and an unlabeled one as no group', () => {
    const { getByRole, queryByRole, rerender } = render(<Powerline aria-label="route"><Badge>a</Badge></Powerline>);
    expect(getByRole('group', { name: 'route' })).toBeTruthy();
    rerender(<Powerline><Badge>a</Badge></Powerline>);
    expect(queryByRole('group')).toBeNull();
  });

  it('threads the endCap of child N to the left edge of child N+1', () => {
    const [, afterChevron] = fills(['chevron', undefined]);
    const [, afterFlat] = fills([undefined, undefined]);
    expect(afterChevron).toBeTruthy();
    expect(afterChevron).not.toBe(afterFlat);
  });

  it('gives the left edge the new neighbor’s cap when the children change', () => {
    function Row() {
      const [cap, setCap] = useState<EdgeCap>('flat');
      return (
        <>
          <button type="button" onClick={() => setCap('chevron')}>go</button>
          <Powerline variant="solid">
            <Badge endCap={cap}>a</Badge>
            <Badge>b</Badge>
          </Powerline>
        </>
      );
    }
    const { container, getByText } = render(<Row />);
    const second = () => container.querySelectorAll('.badge-fill')[1]?.getAttribute('d');
    const before = second();
    fireEvent.click(getByText('go'));
    expect(second()).not.toBe(before);
    expect(second()).toBe(fills(['chevron', undefined])[1]);
  });

  it('applies row-level variant and size defaults, and lets a badge’s own win', () => {
    const { container } = render(
      <Powerline variant="solid" size="md">
        <Badge emphasis="high">a</Badge>
        <Badge grade="info" variant="outline">b</Badge>
      </Powerline>,
    );
    const badges = container.querySelectorAll('[data-variant]');
    expect(badges[0].getAttribute('data-emphasis')).toBe('high');
    expect(badges[0].getAttribute('data-variant')).toBe('solid');
    expect(badges[0].getAttribute('data-size')).toBe('md');
    expect(badges[1].getAttribute('data-grade')).toBe('info');
    expect(badges[1].getAttribute('data-variant')).toBe('outline');
  });

  it('draws a puzzle cap as a tab on its segment and a socket in the next', () => {
    const xs = fills(['puzzle', undefined]).map((d) =>
      [...(d ?? '').matchAll(/[ML] (-?[\d.]+) /g)].map((m) => Number(m[1])),
    );
    expect(xs.length).toBe(2);
    expect(Math.max(...xs[0])).toBeGreaterThan(100);
    expect(xs[1].some((x) => x > 0 && x < 50)).toBe(true);
  });

  it('makes each badge in a fragment a segment of its own', () => {
    const [, afterFragment] = (() => {
      const { container, unmount } = render(
        <Powerline variant="solid">
          <>
            <Badge endCap="chevron">a</Badge>
          </>
          {[<Badge key="b">b</Badge>]}
        </Powerline>,
      );
      const ds = [...container.querySelectorAll('.badge-fill')].map((path) => path.getAttribute('d'));
      unmount();
      return ds;
    })();
    expect(afterFragment).toBe(fills(['chevron', undefined])[1]);
  });

  it('leaves a badge inside a segment’s content off the powerline', () => {
    const { container } = render(
      <Powerline>
        <Badge>outer <Badge>inner</Badge></Badge>
      </Powerline>,
    );
    const shapes = [...container.querySelectorAll('[data-shape]')].map((el) => el.getAttribute('data-shape'));
    expect(shapes).toEqual(['compose', 'pill']);
  });

  it('draws a segment exactly as a badge given the powerline base by hand', () => {
    const { container: row } = render(
      <Powerline variant="solid" depth={8}>
        <Badge endCap="chevron">a</Badge>
        <Badge endCap="slant">b</Badge>
      </Powerline>,
    );
    const { container: hand } = render(
      <Badge variant="solid" base="powerline" baseParams={{ leftEdge: 'chevron', rightEdge: 'slant', depth: 8 }}>b</Badge>,
    );
    expect(row.querySelectorAll('.badge-fill')[1]?.getAttribute('d')).toBe(hand.querySelector('.badge-fill')?.getAttribute('d'));
  });

  it('accepts a custom EdgeProfile function as a cap', () => {
    const custom = (t: number, d: number) => Math.sin(t * Math.PI * 4) * d * 0.5;
    const [capped] = fills([custom, undefined]);
    const [flat] = fills(['flat', undefined]);
    expect(capped).toBeTruthy();
    expect(capped).not.toBe(flat);
  });
});

describe('package root export', () => {
  it('re-exports Powerline from the package root', () => {
    expect(PkgRoot.Powerline).toBeDefined();
    expect(PkgRoot.usePowerlineSegment).toBeDefined();
  });

  it('re-exports EDGE_PROFILES from the package root', () => {
    expect(PkgRoot.EDGE_PROFILES).toBeDefined();
    expect(typeof PkgRoot.EDGE_PROFILES.chevron).toBe('function');
  });
});
