import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ActionsProvider, useAction } from '../interactions/actions/ActionsProvider';
import { useMenuHost, useMenus } from './MenuHostContext';
import type { MenuHost } from './menuHost';

const cut = { id: 'cut', label: 'Cut', invoker: { timing: 'immediate' as const, run: () => {} } };
const defs = [{ id: 'row', sections: [[{ action: 'cut' }]] }];

describe('useMenus', () => {
  it('registers defs on the host ActionsProvider created, for its lifetime', () => {
    let host: MenuHost | null = null;
    function Probe() {
      useAction(cut);
      useMenus(defs);
      host = useMenuHost();
      return null;
    }
    const { unmount } = render(<ActionsProvider><Probe /></ActionsProvider>);
    expect(host!.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
    unmount();
    expect(host!.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
});
