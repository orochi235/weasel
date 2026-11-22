import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, DepRegistryProvider, useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { dynamicActionId, type ActionsRegistry, type DepRegistry, type LastOperation, type LastOperationStore } from '@weasel-js/routing';
import type { Op } from '@weasel-js/history';
import {
  createHistory,
} from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { LastOperationPanel } from './LastOperationPanel';

afterEach(cleanup);

const SCHEMA = pref.group('Bridge', {
  tension: pref.number('Tension', 0.4, { min: 0, max: 1.5, step: 0.05 }),
  closed: pref.boolean('Closed', false),
});

function storeOf(op: LastOperation | null): LastOperationStore {
  return { get: () => op, subscribe: () => () => {}, adjust: vi.fn(() => true), dismiss: vi.fn() };
}

describe('LastOperationPanel', () => {
  it('draws nothing while there is no operation', () => {
    const { container } = render(<LastOperationPanel store={storeOf(null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is titled with the command and holds its params at the values it used', () => {
    render(<LastOperationPanel store={storeOf({ id: 'bridgePaths', label: 'Bridge', schema: SCHEMA, values: { tension: 0.8, closed: true } })} />);
    expect(screen.getByRole('region', { name: 'Bridge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bridge' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Tension' })).toHaveValue('0.8');
    expect(screen.getByRole('checkbox', { name: 'Closed' })).toBeChecked();
  });

  it('shows a leaf under a subgroup at the value it ran with', () => {
    const schema = pref.group('Offset', { outline: pref.group('Outline', { width: pref.number('Width', 1) }) });
    const store = storeOf({ id: 'offset', label: 'Offset', schema, values: { 'outline.width': 4 } });
    render(<LastOperationPanel store={store} />);
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    expect(width).toHaveValue('4');
    fireEvent.change(width, { target: { value: '6' } });
    fireEvent.blur(width);
    expect(store.adjust).toHaveBeenCalledWith({ 'outline.width': 6 });
  });

  it('adjusts the operation by the field changed, and dismisses it from its close button', () => {
    const store = storeOf({ id: 'bridgePaths', label: 'Bridge', schema: SCHEMA, values: { tension: 0.4, closed: false } });
    render(<LastOperationPanel store={store} closeLabel="Close Bridge" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Closed' }));
    expect(store.adjust).toHaveBeenCalledWith({ closed: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close Bridge' }));
    expect(store.dismiss).toHaveBeenCalled();
  });

  it('calls dismiss as a method of a store written as a class', () => {
    class Store implements LastOperationStore {
      op: LastOperation | null = { id: 'bridgePaths', label: 'Bridge', schema: SCHEMA, values: { tension: 0.4, closed: false } };
      get() { return this.op; }
      subscribe() { return () => {}; }
      adjust() { return true; }
      dismiss() { this.op = null; }
    }
    const store = new Store();
    render(<LastOperationPanel store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(store.op).toBeNull();
  });

  it('follows the store of the actions tree in scope', () => {
    const doc = { width: 0 };
    const history = createHistory(doc);
    let registry: ActionsRegistry | null = null;
    let deps: DepRegistry | null = null;
    function Grab() {
      registry = useActionsRegistry();
      deps = useDepRegistry();
      return null;
    }
    render(<DepRegistryProvider><ActionsProvider><Grab /><LastOperationPanel /></ActionsProvider></DepRegistryProvider>);
    act(() => {
      deps!.register('history', () => history);
      registry!.register({
        id: 'widen', label: 'Widen', params: pref.group('Widen', { by: pref.number('By', 1) }),
        invoker: {
          timing: 'immediate',
          run: (_d, params) => {
            const to = doc.width + Number(params?.by ?? 1);
            const op = (a: number, b: number): Op => ({ apply: () => { doc.width = b; }, invert: () => op(b, a) });
            history.applyOps([op(doc.width, to)], 'Widen');
          },
        },
      });
    });
    expect(screen.queryByRole('region')).toBeNull();
    act(() => { registry!.trigger(dynamicActionId('widen'), { by: 2 }); });
    expect(screen.getByRole('region', { name: 'Widen' })).toBeInTheDocument();
    act(() => { history.undo(); });
    expect(screen.queryByRole('region')).toBeNull();
  });
});
