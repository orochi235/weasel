import { describe, expect, it } from 'vitest';
import { createSelectionStore } from '@weasel-js/select';
import { asNodeId, type NodeId } from 'core/scene/types';
import { readOnlySelection } from './readOnlySelection';
import type { SelectionApi } from './useSelection';

const A = asNodeId('a');
const B = asNodeId('b');

function makeApi(): SelectionApi {
  const store = createSelectionStore<NodeId>([A]);
  const get = (): NodeId[] => store.getSelection() as NodeId[];
  const set = (ids: NodeId[]): void => store.setSelection(ids);
  return {
    get current() { return get(); },
    get,
    set,
    add: (id) => set([...get(), id]),
    remove: (id) => set(get().filter((x) => x !== id)),
    toggle: (id) => set(get().includes(id) ? get().filter((x) => x !== id) : [...get(), id]),
    clear: () => set([]),
    contains: (id) => get().includes(id),
    applyClick: (id) => set([id]),
    adapterMethods: { getSelection: get, setSelection: set },
  };
}

describe('readOnlySelection', () => {
  it('ignores every write, its adapter methods included', () => {
    const api = makeApi();
    const view = readOnlySelection(api);
    view.set([B]);
    view.add(B);
    view.remove(A);
    view.toggle(B);
    view.clear();
    view.applyClick(B, { shift: false, meta: false, ctrl: false });
    view.adapterMethods.setSelection([B]);
    expect(api.get()).toEqual([A]);
  });

  it('reads what the wrapped api holds now, not what it held when wrapped', () => {
    const api = makeApi();
    const view = readOnlySelection(api);
    api.set([B]);
    expect(view.current).toEqual([B]);
    expect(view.get()).toEqual([B]);
    expect(view.contains(B)).toBe(true);
    expect(view.contains(A)).toBe(false);
    expect(view.adapterMethods.getSelection()).toEqual([B]);
  });

  it('answers one view per api', () => {
    const api = makeApi();
    expect(readOnlySelection(api)).toBe(readOnlySelection(api));
    expect(readOnlySelection(makeApi())).not.toBe(readOnlySelection(api));
  });

  it('keeps one set of adapter methods for an api rebuilt around the same ones', () => {
    const api = makeApi();
    const rebuilt: SelectionApi = { ...api, get current() { return api.current; } };
    const first = readOnlySelection(api);
    const second = readOnlySelection(rebuilt);
    expect(second).not.toBe(first);
    expect(second.adapterMethods).toBe(first.adapterMethods);
  });
});
