import { describe, it, expect } from 'vitest';
import { createEmitter } from '@weasel-js/registry';
import { createNotices } from './notices';
import type { DevtoolsArea, PageMessage } from './protocol';
import type { DevtoolsRoot } from './root';

function fakeRoot(): DevtoolsRoot & { change(area: DevtoolsArea): void; dimension: '2d' | '3d' } {
  const changes = createEmitter<[area: DevtoolsArea]>();
  const versions = { scene: 0, selection: 0, view: 0, tool: 0, trace: 0, registry: 0, history: 0 };
  const watch = () => () => {};
  return {
    id: 'r',
    source: { trace: { watch }, coords: { watch } } as unknown as DevtoolsRoot['source'],
    dimension: '2d',
    info() { return { id: 'r', label: 'r', dimension: this.dimension }; },
    probes: new Map(),
    version: (area) => versions[area],
    notify: () => {},
    subscribe: changes.subscribe,
    change(area) {
      versions[area]++;
      changes.emit(area);
    },
  };
}

describe('createNotices', () => {
  it('keeps a change made while a flush is sending, for the next flush', () => {
    const root = fakeRoot();
    const queued: Array<() => void> = [];
    const sent: PageMessage[] = [];
    const notices = createNotices(() => root, (f) => queued.push(f), (m) => {
      sent.push(m);
      // A panel answering in the same call stack can change the root again.
      if (sent.length === 1) root.change('selection');
    });
    notices.follow(root);
    root.change('scene');
    queued.shift()!();
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(sent.map((m) => m.type === 'changed' && Object.keys(m.areas))).toEqual([['scene'], ['selection']]);
  });

  it('announces a root again when its dimension changes after it was followed', () => {
    const root = fakeRoot();
    const sent: PageMessage[] = [];
    const notices = createNotices(() => root, (f) => f(), (m) => sent.push(m));
    notices.follow(root);
    root.change('scene');
    expect(sent.map((m) => m.type)).toEqual(['changed']);
    root.dimension = '3d';
    root.change('scene');
    expect(sent.slice(1)).toMatchObject([{ type: 'root-added', root: { id: 'r', dimension: '3d' } }, { type: 'changed' }]);
  });
});
