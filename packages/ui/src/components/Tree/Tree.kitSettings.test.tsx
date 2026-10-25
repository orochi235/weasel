import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { Tree, type TreeNode } from './Tree';
import { TYPEAHEAD_MS } from '../../useTypeahead';
import { REST_MS } from './useRowTip';
import { HOVER_EXPAND_MS } from './useTreeDrag';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', tooltip: 'A group.', children: [{ id: 'x', label: 'Ex' }] },
  { id: 'z', label: 'Zed' },
];

const under = (settings: KitSettingsOverrides | undefined, node: ReactNode) =>
  settings === undefined ? node : <KitSettingsProvider value={settings}>{node}</KitSettingsProvider>;

const item = (name: string) => screen.getByRole('treeitem', { name });

describe('Tree kit settings', () => {
  describe('tree.typeaheadMs', () => {
    // Two keys `wait` apart: one prefix ("gz", matching nothing, so focus stays) while the wait is inside the
    // setting, two searches ("z" lands on Zed) once it is past.
    const typeTwo = (settings: KitSettingsOverrides | undefined, wait: number) => {
      render(under(settings, <Tree aria-label="T" nodes={NODES} />));
      vi.useFakeTimers({ toFake: ['Date'] });
      act(() => item('Group').focus());
      fireEvent.keyDown(document.activeElement!, { key: 'g' });
      vi.advanceTimersByTime(wait);
      fireEvent.keyDown(document.activeElement!, { key: 'z' });
      return document.activeElement;
    };

    it('holds a prefix for the constant with no provider', () => {
      expect(typeTwo(undefined, TYPEAHEAD_MS - 1)).toBe(item('Group'));
      cleanup();
      expect(typeTwo(undefined, TYPEAHEAD_MS + 1)).toBe(item('Zed'));
    });

    it("holds a prefix for the provider's time", () => {
      expect(typeTwo({ tree: { typeaheadMs: 50 } }, 51)).toBe(item('Zed'));
      cleanup();
      expect(typeTwo({ tree: { typeaheadMs: 2000 } }, TYPEAHEAD_MS + 1)).toBe(item('Group'));
    });
  });

  describe('tree.tipRestMs', () => {
    const tipAfter = (settings: KitSettingsOverrides | undefined, wait: number) => {
      vi.useFakeTimers();
      render(under(settings, <Tree aria-label="T" nodes={NODES} />));
      fireEvent.pointerEnter(item('Group').firstElementChild!);
      act(() => { vi.advanceTimersByTime(wait); });
      return screen.queryByRole('tooltip');
    };

    it('opens after the constant with no provider', () => {
      expect(tipAfter(undefined, REST_MS - 1)).toBeNull();
      cleanup();
      expect(tipAfter(undefined, REST_MS)).not.toBeNull();
    });

    it("opens after the provider's time", () => {
      expect(tipAfter({ tree: { tipRestMs: 50 } }, 50)).not.toBeNull();
      cleanup();
      expect(tipAfter({ tree: { tipRestMs: 1000 } }, REST_MS)).toBeNull();
    });
  });

  describe('tree.hoverExpandMs', () => {
    const ROW = 24;
    const expandedAfter = (settings: KitSettingsOverrides | undefined, wait: number) => {
      vi.useFakeTimers();
      const onExpandedChange = vi.fn();
      render(under(settings, <Tree aria-label="T" nodes={NODES} onMove={() => {}} onExpandedChange={onExpandedChange} />));
      const tree = screen.getByRole('tree');
      tree.setPointerCapture = vi.fn();
      tree.releasePointerCapture = vi.fn();
      tree.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((li, i) => {
        Object.defineProperty(li.firstElementChild, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ top: i * ROW, height: ROW, left: 0, width: 200, bottom: (i + 1) * ROW, right: 200, x: 0, y: i * ROW }) as DOMRect,
        });
      });
      fireEvent.pointerDown(item('Zed').firstElementChild!, { pointerId: 1, button: 0, clientX: 100, clientY: 40 });
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 100, clientY: 12 });
      act(() => { vi.advanceTimersByTime(wait); });
      return onExpandedChange.mock.calls.length > 0;
    };

    it('opens a branch after the constant with no provider', () => {
      expect(expandedAfter(undefined, HOVER_EXPAND_MS - 1)).toBe(false);
      cleanup();
      expect(expandedAfter(undefined, HOVER_EXPAND_MS)).toBe(true);
    });

    it("opens a branch after the provider's time", () => {
      expect(expandedAfter({ tree: { hoverExpandMs: 50 } }, 50)).toBe(true);
      cleanup();
      expect(expandedAfter({ tree: { hoverExpandMs: 2000 } }, HOVER_EXPAND_MS)).toBe(false);
    });
  });
});
