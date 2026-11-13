import { act, renderHook } from '@testing-library/react';
import {
  ActionsProvider, DepRegistryProvider, asNodeId, pagesOf, useActionsRegistry, type ActionsRegistry,
} from '@weasel-js/core';
import { usePages } from '@weasel-js/editor';
import { DEFAULT_MODES } from '@weasel-js/modes';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createModeMachine } from '../modality/machine';
import { drawScene } from '../testScenes';
import { PAGE_ACTIONS, usePageCommands } from './pageCommands';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };
const wrapper = ({ children }: { children: ReactNode }) => (
  <DepRegistryProvider><ActionsProvider>{children}</ActionsProvider></DepRegistryProvider>
);

function setup(mode: 'path-edit' | 'text-edit') {
  const scene = drawScene([{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 100, height: 100 }]);
  const shape = scene.add({
    kind: 'mark', layer: 'default', parent: asNodeId('a'), pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
  });
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: scene.history });
  scene.setActiveJournalAccessor(() => machine.getActiveJournal());
  let registry: ActionsRegistry | null = null;
  renderHook(() => {
    const pages = usePages(scene, VIEW, DIMS, () => {});
    usePageCommands(pages, machine.leaveMode);
    registry = useActionsRegistry();
  }, { wrapper });
  machine.enterMode(mode, { targetId: shape });
  return { scene, shape, machine, trigger: (params: Record<string, unknown>) => act(() => { (registry as unknown as ActionsRegistry).trigger(PAGE_ACTIONS.remove, params); }) };
}

describe('Delete Page', () => {
  for (const mode of ['path-edit', 'text-edit'] as const) {
    it(`leaves ${mode} before deleting the page, as New and Open do, so the delete is its own undo entry`, () => {
      const { scene, shape, machine, trigger } = setup(mode);
      trigger({ page: 'a' });
      expect(machine.registry.current().id).toBe('normal');
      expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['b']);
      act(() => { scene.undo(); });
      expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['a', 'b']);
      expect(scene.get(shape)).toBeDefined();
    });
  }
});
