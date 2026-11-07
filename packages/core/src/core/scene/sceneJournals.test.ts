import { describe, expect, it } from 'vitest';
import { createHistory, type Journal } from '@weasel-js/history';
import type { SceneHistoryEnv } from './historyFacade';
import { createSceneJournals } from './sceneJournals';

function journals() {
  const engine = createHistory({});
  let open: () => Journal | null = () => null;
  const env: SceneHistoryEnv = {
    engine,
    applying: (step) => step(),
    causing: (op) => op,
    replay: (step) => step(),
    notify: () => {},
    refuseUntracked: () => {},
    runArrivalEdit: (ops, run) => run(ops),
    labeled: (_label, fn) => fn(),
    activeJournal: () => open(),
  };
  const sj = createSceneJournals(env);
  open = sj.innermost;
  return sj;
}

describe('createSceneJournals', () => {
  it('forgets a journal its parent closed', () => {
    const sj = journals();
    const outer = sj.begin({ label: 'outer' });
    sj.begin({ label: 'inner' });
    outer.cancel();
    expect(sj.opened()).toEqual([]);
  });

  it('forgets a suspended journal inside one that committed', () => {
    const sj = journals();
    const outer = sj.begin({ label: 'outer' });
    sj.begin({ label: 'inner' }).suspend();
    outer.commit('Outer');
    expect(sj.opened()).toEqual([]);
  });
});
