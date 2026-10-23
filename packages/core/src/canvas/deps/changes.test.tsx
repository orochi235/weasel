import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { createScene } from '../../core/scene/scene';
import { useDepChangeNotices } from './changes';

describe('useDepChangeNotices', () => {
  function setup() {
    const scene = createScene<object, 'main'>({ systemLayers: [{ id: 'main' }] });
    const heard = vi.fn();
    let registry!: DepRegistry;
    function Probe({ selected }: { selected: readonly string[] }) {
      registry = useDepRegistry();
      useDepChangeNotices(scene, selected);
      return null;
    }
    const view = (selected: readonly string[]) => <DepRegistryProvider><Probe selected={selected} /></DepRegistryProvider>;
    const none: readonly string[] = [];
    const utils = render(view(none));
    registry.subscribe!(heard);
    return { scene, heard, none, rerender: (selected: readonly string[]) => utils.rerender(view(selected)), unmount: utils.unmount };
  }

  it('says so when the scene changes, and stops when it unmounts', () => {
    const { scene, heard, unmount } = setup();
    act(() => { scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} }); });
    expect(heard).toHaveBeenCalled();
    unmount();
    heard.mockClear();
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    expect(heard).not.toHaveBeenCalled();
  });

  it('says so when the selection changes, and not for a render that keeps it', () => {
    const { heard, none, rerender } = setup();
    rerender(none);
    expect(heard).not.toHaveBeenCalled();
    rerender(['a']);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
