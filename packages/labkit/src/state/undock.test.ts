import { describe, expect, it } from 'vitest';
import { dockPanel, panelKey, undockPanel } from './undock';

describe('undocked panel bookkeeping', () => {
  it('keys a panel by its trial and section, so two trials can undock the same section', () => {
    expect(panelKey('t1', 'settings')).not.toBe(panelKey('t2', 'settings'));
  });

  it('records an undock as a tile by default', () => {
    const next = undockPanel({}, 't1', 'settings');
    expect(next[panelKey('t1', 'settings')]).toEqual({
      trialId: 't1',
      sectionId: 'settings',
      as: 'tile',
    });
  });

  it('records the requested target', () => {
    const next = undockPanel({}, 't1', 'settings', 'floating');
    expect(next[panelKey('t1', 'settings')]?.as).toBe('floating');
  });

  it('re-undocking to a different target moves it rather than adding a second', () => {
    const once = undockPanel({}, 't1', 'settings', 'tile');
    const twice = undockPanel(once, 't1', 'settings', 'floating');
    expect(Object.keys(twice)).toHaveLength(1);
    expect(twice[panelKey('t1', 'settings')]?.as).toBe('floating');
  });

  it('docking removes it and leaves other panels alone', () => {
    const both = undockPanel(undockPanel({}, 't1', 'a'), 't1', 'b');
    const next = dockPanel(both, 't1', 'a');
    expect(Object.keys(next)).toEqual([panelKey('t1', 'b')]);
  });

  it('closing a trial takes its undocked panels with it', () => {
    const panels = undockPanel(undockPanel({}, 't1', 'a'), 't2', 'a');
    expect(Object.keys(dockPanel(panels, 't1'))).toEqual([panelKey('t2', 'a')]);
  });
});
