import { useLayoutEffect, useState } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderThenAbandon } from './testing/abandonRender';
import { useLatest } from './useLatest';

describe('useLatest', () => {
  it('never holds a value from a render that did not commit', () => {
    let latest!: { readonly current: string };
    function Probe({ v }: { v: string }): null {
      latest = useLatest(v);
      return null;
    }
    renderThenAbandon('committed', 'abandoned', (v) => <Probe v={v} />);
    expect(latest.current).toBe('committed');
  });

  // Both readers' layout effects run before the writer's own would, so a
  // write from a layout effect fails this; one from render or an insertion
  // effect passes.
  it('lands before layout effects in the same commit, a child\'s and an earlier sibling\'s', () => {
    const seen: string[] = [];
    let setV!: (v: string) => void;
    const box: { ref?: { readonly current: string } } = {};
    function Reader({ name }: { name: string }): null {
      useLayoutEffect(() => { seen.push(`${name}:${box.ref?.current}`); });
      return null;
    }
    function Writer({ v }: { v: string }): React.ReactNode {
      box.ref = useLatest(v);
      return <Reader name="child" />;
    }
    function Host(): React.ReactNode {
      const [v, set] = useState('a');
      setV = set;
      return <><Reader name="sibling" /><Writer v={v} /></>;
    }
    render(<Host />);
    seen.length = 0;
    act(() => { setV('b'); });
    expect(seen).toEqual(['sibling:b', 'child:b']);
  });
});
