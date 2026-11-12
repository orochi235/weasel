import { renderHook } from '@testing-library/react';
import { ActionsProvider, useActionsRegistry, type Action } from '@weasel-js/core';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { GROUP_ACTIONS, useGroupCommands } from './pipelineGroups';
import { PIPELINE_ACTIONS, usePipelineCommands } from './pipelineCommands';
import { emptyPipeline, type PipelineDoc } from './usePipelineDoc';

const pipeline: PipelineDoc = {
  doc: emptyPipeline(), change: () => {}, undo: () => {}, redo: () => {}, canUndo: true, canRedo: true,
};
const wrapper = ({ children }: { children: ReactNode }) => <ActionsProvider>{children}</ActionsProvider>;

describe('pipeline commands', () => {
  it('holds the keys that edit the pipeline off while a gesture is in flight, as the kit undo does', () => {
    const { result } = renderHook(() => {
      usePipelineCommands(pipeline);
      useGroupCommands({ current: null }, { stage: null, group: null, picked: [], pickGroup: () => {} });
      return useActionsRegistry()!;
    }, { wrapper });
    const phaseOf = (a: Action | undefined) =>
      [a?.defaultBinding ?? []].flat().map((b) => ('spec' in b ? b.spec : b as unknown as { phase?: unknown }).phase);
    for (const id of [PIPELINE_ACTIONS.undo, PIPELINE_ACTIONS.redo, GROUP_ACTIONS.group, GROUP_ACTIONS.ungroup]) {
      const action = result.current.list().find((a) => a.id === id);
      expect(phaseOf(action), id).toEqual([[{ channel: '*', phase: 'initial' }]]);
    }
  });
});
