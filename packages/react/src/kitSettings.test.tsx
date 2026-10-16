import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createKitSettingsStore, type KitSettingPath } from './kitSettings';
import { KitSettingsProvider, useKitSetting, useKitSettings } from './useKitSetting';

interface Demo {
  tree: { typeaheadMs: number; hoverMs: number };
  params: { lab: { textWaitMs: number } };
}

describe('createKitSettingsStore', () => {
  it('reads its own leaf, then its parent\'s, then nothing', () => {
    const parent = createKitSettingsStore<Demo>({ tree: { typeaheadMs: 500, hoverMs: 600 } });
    const child = createKitSettingsStore<Demo>({ tree: { typeaheadMs: 250 }, params: { lab: { textWaitMs: 90 } } }, parent);
    expect(child.get('tree.typeaheadMs')).toBe(250);
    expect(child.get('tree.hoverMs')).toBe(600);
    expect(child.get('params.lab.textWaitMs')).toBe(90);
    expect(parent.get('params.lab.textWaitMs')).toBeUndefined();
  });

  it('notifies on a changed leaf and not on an equal tree', () => {
    const store = createKitSettingsStore<Demo>({ tree: { typeaheadMs: 500 } });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ tree: { typeaheadMs: 500 } });
    expect(calls).toBe(0);
    store.set({ tree: { typeaheadMs: 400 } });
    expect(calls).toBe(1);
    store.set({});
    expect(calls).toBe(2);
  });

  it('passes a parent\'s change on to its own listeners, and lets go once it has none', () => {
    const parent = createKitSettingsStore<Demo>({});
    const child = createKitSettingsStore<Demo>({}, parent);
    let calls = 0;
    const off = child.subscribe(() => calls++);
    parent.set({ tree: { hoverMs: 1 } });
    expect(calls).toBe(1);
    off();
    parent.set({ tree: { hoverMs: 2 } });
    expect(calls).toBe(1);
  });

  it('types paths from the tree it holds', () => {
    const ok: KitSettingPath<Demo> = 'params.lab.textWaitMs';
    // @ts-expect-error an area is not a leaf
    const area: KitSettingPath<Demo> = 'tree';
    expect([ok, area]).toHaveLength(2);
  });
});

// The hooks are typed on the augmented `KitSettings`, which no test should
// augment for the whole program, so paths are cast here.
const at = (path: string) => path as never;

describe('useKitSetting', () => {
  it('is undefined with no provider, and the nearest provider\'s value inside one', () => {
    const seen: unknown[] = [];
    function Probe(): null {
      seen.push(useKitSetting(at('tree.typeaheadMs')));
      return null;
    }
    render(<Probe />);
    render(
      <KitSettingsProvider value={{ tree: { typeaheadMs: 500 } } as never}>
        <KitSettingsProvider value={{ tree: { hoverMs: 1 } } as never}>
          <Probe />
        </KitSettingsProvider>
      </KitSettingsProvider>,
    );
    expect(seen).toEqual([undefined, 500]);
  });

  it('re-renders a reader when its own path changes, and not for another path', () => {
    const renders = { typeahead: 0, hover: 0 };
    function Typeahead(): null {
      useKitSetting(at('tree.typeaheadMs'));
      renders.typeahead++;
      return null;
    }
    function Hover(): null {
      useKitSetting(at('tree.hoverMs'));
      renders.hover++;
      return null;
    }
    let setMs!: (ms: number) => void;
    function Host(): React.ReactNode {
      const [ms, set] = useState(500);
      setMs = set;
      return (
        <KitSettingsProvider value={{ tree: { typeaheadMs: ms, hoverMs: 600 } } as never}>
          <Static />
        </KitSettingsProvider>
      );
    }
    // Memoized away from Host's render, so only the store can re-render them.
    const Static = (() => {
      const children = <><Typeahead /><Hover /></>;
      return function Static(): React.ReactNode {
        return children;
      };
    })();
    render(<Host />);
    const before = { ...renders };
    act(() => setMs(250));
    expect(renders.typeahead).toBe(before.typeahead + 1);
    expect(renders.hover).toBe(before.hover);
  });

  it('hands code outside React the store to read at the moment it needs a value', () => {
    let read!: () => unknown;
    function Probe(): null {
      const store = useKitSettings();
      read = () => store.get(at('tree.hoverMs'));
      return null;
    }
    let setMs!: (ms: number) => void;
    function Host(): React.ReactNode {
      const [ms, set] = useState(600);
      setMs = set;
      return <KitSettingsProvider value={{ tree: { hoverMs: ms } } as never}><Probe /></KitSettingsProvider>;
    }
    render(<Host />);
    expect(read()).toBe(600);
    act(() => setMs(700));
    expect(read()).toBe(700);
  });
});
