import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { ActionsProvider, DepRegistryProvider, useActionsRegistry, useDepRegistry, type ActionsRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { Action, SelectionApi } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { useActionSet, useStandardDeps } from './useActionSet';

type S = Scene<object, 'main'>;
const POSE = { x: 0, y: 0, width: 1, height: 1 };

function addOp(scene: S, id: NodeId): Op {
  return {
    label: 'add',
    apply: () => { scene.add({ id, kind: 'mark', layer: 'main', pose: POSE, data: {} }); },
    invert: () => ({ label: 'remove', apply: () => { scene.remove(id); }, invert: () => addOp(scene, id) }),
  };
}

function selectionOf(current: readonly string[]): SelectionApi {
  return { current } as unknown as SelectionApi;
}

function setup() {
  const scene: S = createScene<object, 'main'>({ systemLayers: [{ id: 'main' }] });
  let registry!: DepRegistry;
  function Probe({ selected }: { selected: readonly string[] }) {
    registry = useDepRegistry();
    useStandardDeps({ scene: scene as never, history: scene.history, selection: selectionOf(selected) });
    return null;
  }
  const view = (selected: readonly string[]) => <DepRegistryProvider><Probe selected={selected} /></DepRegistryProvider>;
  const none: readonly string[] = [];
  const utils = render(view(none));
  const heard: boolean[] = [];
  registry.subscribe!(() => { heard.push(scene.history.canRedo()); });
  return { scene, heard, none, rerender: (s: readonly string[]) => utils.rerender(view(s)), unmount: utils.unmount };
}

describe('useStandardDeps change notices', () => {
  it('says so when the scene changes, and stops when it unmounts', () => {
    const { scene, heard, unmount } = setup();
    act(() => { scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} }); });
    expect(heard.length).toBeGreaterThan(0);
    unmount();
    heard.length = 0;
    scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    expect(heard).toEqual([]);
  });

  it('says so once the history has moved, so a reader sees the new undo and redo state', () => {
    const { scene, heard } = setup();
    act(() => { scene.history.apply(addOp(scene, 'n1' as NodeId)); });
    heard.length = 0;
    act(() => { scene.undo(); });
    expect(heard.at(-1)).toBe(true);
  });

  it('says so when the selection changes, and not for a render that keeps it', () => {
    const { heard, none, rerender } = setup();
    rerender(none);
    expect(heard).toEqual([]);
    rerender(['a']);
    expect(heard).toHaveLength(1);
  });
});

describe('useActionSet', () => {
  it('leaves out exactly the ids it is told to, whatever characters they hold', () => {
    const actions = ['a', 'b', 'a\u0000b'].map((id) => ({ id, label: id, kind: 'instant', run: () => {} }) as unknown as Action);
    let reg!: ActionsRegistry;
    function Probe() {
      reg = useActionsRegistry()!;
      useActionSet(actions, ['a\u0000b']);
      return null;
    }
    render(<DepRegistryProvider><ActionsProvider><Probe /></ActionsProvider></DepRegistryProvider>);
    expect(reg.list().map((a) => a.id).sort()).toEqual(['a', 'b']);
  });
});
