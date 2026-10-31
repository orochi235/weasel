import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider, createHistory, DepRegistryProvider, useActionsRegistry, useDepRegistry,
  type ActionsRegistry, type DepRegistry, type LastOperation, type LastOperationStore, type Op,
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

  it('adjusts the operation by the field changed, and dismisses it from its close button', () => {
    const store = storeOf({ id: 'bridgePaths', label: 'Bridge', schema: SCHEMA, values: { tension: 0.4, closed: false } });
    render(<LastOperationPanel store={store} closeLabel="Close Bridge" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Closed' }));
    expect(store.adjust).toHaveBeenCalledWith({ closed: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close Bridge' }));
    expect(store.dismiss).toHaveBeenCalled();
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
    act(() => { registry!.trigger('widen', { by: 2 }); });
    expect(screen.getByRole('region', { name: 'Widen' })).toBeInTheDocument();
    act(() => { history.undo(); });
    expect(screen.queryByRole('region')).toBeNull();
  });
});
