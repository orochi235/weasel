import { describe, expect, it } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { render } from '@testing-library/react';
import { ActionsProvider, useAction } from '../interactions/actions/ActionsProvider';
import { useMenuHost, useMenus } from './MenuHostContext';
import type { MenuHost } from './menuHost';

const cut = { id: 'cut', label: 'Cut', invoker: { timing: 'immediate' as const, run: () => {} } };
const defs = [{ id: 'row', schema: pref.group('', { cut: pref.action('cut') }) }];

describe('useMenus', () => {
  it('registers defs on the host ActionsProvider created, for its lifetime', () => {
    let host: MenuHost | null = null;
    function Menus() {
      useMenus(defs);
      return null;
    }
    function Outer({ show }: { show: boolean }) {
      useAction(cut);
      host = useMenuHost();
      return show ? <Menus /> : null;
    }
    const { rerender } = render(<ActionsProvider><Outer show /></ActionsProvider>);
    expect(host!.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
    rerender(<ActionsProvider><Outer show={false} /></ActionsProvider>);
    expect(host!.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
});
