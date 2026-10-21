import { useCommand } from '@weasel-js/core';
import type { EditorLook } from '@weasel-js/diagram/effect';
import { pref } from '@weasel-js/prefs';
import type { MenuRuns } from '../menuBar';

export const LOOK_ACTIONS = { nodeGraph: 'pipeline.look.nodeGraph', rack: 'pipeline.look.rack', lanes: 'pipeline.look.lanes' } as const;

/** Pipeline mode's View menu: the Look submenu. */
export const LOOK_MENU: MenuRuns = {
  look: pref.group('', {
    look: pref.group('Look', {
      nodeGraph: pref.action(LOOK_ACTIONS.nodeGraph),
      rack: pref.action(LOOK_ACTIONS.rack),
      lanes: pref.action(LOOK_ACTIONS.lanes),
    }, { as: 'menu' }),
  }),
};

/** Registers View › Look › Node graph, Rack and Lanes, each reading as held while its look is on. */
export function useLookCommands(look: EditorLook, setLook: (look: EditorLook) => void): void {
  useCommand(LOOK_ACTIONS.nodeGraph, 'Node graph', () => setLook('nodeGraph'), { active: () => look === 'nodeGraph' });
  useCommand(LOOK_ACTIONS.rack, 'Rack', () => setLook('rack'), { active: () => look === 'rack' });
  useCommand(LOOK_ACTIONS.lanes, 'Lanes', () => setLook('lanes'), { active: () => look === 'lanes' });
}
