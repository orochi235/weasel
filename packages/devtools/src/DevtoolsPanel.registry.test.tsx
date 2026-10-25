/** The Registry and History tabs end to end, against a real `<SceneCanvas>` and its hook. */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { NodeId } from '@weasel-js/core';
import { DevtoolsPanel } from './DevtoolsPanel';
import { createInPagePanelTransport } from './inPageTransport';
import { TestCanvas, rootByLabel, stubWebGL } from './testing/mountCanvas';

beforeAll(stubWebGL);
afterEach(cleanup);

function mount(tab: 'registry' | 'history') {
  render(
    <>
      <TestCanvas />
      <DevtoolsPanel transport={createInPagePanelTransport()} tabs={[tab]} />
    </>,
  );
  return { root: () => rootByLabel('board') };
}

const position = () => screen.getByRole('status', { name: 'Position' }).textContent;
const entry = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });

describe('the Registry tab', () => {
  it('lists the canvas\'s tools, actions and deps, under a filter', async () => {
    mount('registry');
    const tools = await screen.findByRole('treeitem', { name: /^Tools\b/ });
    expect(within(tools).getByRole('treeitem', { name: /^hand\b/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^Actions\b/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^Deps\b/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^selection\b/ })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter registry' }), { target: { value: 'hand' } });
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: /^selection\b/ })).toBeNull());
    expect(entry('hand')).toBeTruthy();
  });

  it('shows a tool\'s bindings in route grammar', async () => {
    mount('registry');
    fireEvent.click((await waitFor(() => entry('hand'))).firstElementChild as HTMLElement);
    const bindings = await screen.findByRole('region', { name: 'Bindings' });
    expect(within(bindings).getByText('viewport.dragPan')).toBeTruthy();
    expect(within(bindings).getAllByLabelText(/drag/i).length).toBeGreaterThan(0);
  });

  it('shows an action\'s scope and whether it is enabled', async () => {
    const t = mount('registry');
    const reg = t.root().source.registry!();
    const action = reg.actions[0]!;
    fireEvent.click((await waitFor(() => entry(action.id))).firstElementChild as HTMLElement);
    const detail = await screen.findByRole('region', { name: `Action ${action.id}` });
    expect(detail.textContent).toContain(action.scope);
    expect(detail.textContent).toMatch(action.enabled === true ? /enabled\s*yes/i : new RegExp(action.enabled));
  });
});

describe('the History tab', () => {
  it('logs each step with its ops, and where the history stands', async () => {
    const t = mount('history');
    await waitFor(() => expect(position()).toBe('0 / 0'));
    const scene = t.root().source.scene()!;
    act(() => { scene.setPose('solo' as NodeId, { x: 70, y: 70, width: 20, height: 20 }); });
    await waitFor(() => expect(position()).toBe('1 / 1'));
    expect(screen.getByText('can undo')).toBeTruthy();
    const push = await screen.findByRole('cell', { name: 'push' });
    fireEvent.click(push);
    expect(await screen.findByText('kit:setPose')).toBeTruthy();
    act(() => { scene.undo(); });
    expect(await screen.findByRole('cell', { name: 'undo' })).toBeTruthy();
    await waitFor(() => expect(position()).toBe('0 / 1'));
    expect(screen.getByText('can redo')).toBeTruthy();
  });

  it('shows the checkpoint stack only when asked', async () => {
    const t = mount('history');
    await waitFor(() => expect(position()).toBe('0 / 0'));
    act(() => { t.root().source.scene()!.setPose('solo' as NodeId, { x: 70, y: 70, width: 20, height: 20 }); });
    await waitFor(() => expect(position()).toBe('1 / 1'));
    expect(screen.queryByRole('list', { name: 'Checkpoints' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'checkpoints' }));
    const stack = await screen.findByRole('list', { name: 'Checkpoints' });
    await waitFor(() => expect(within(stack).getAllByRole('listitem')).toHaveLength(1));
  });
});
