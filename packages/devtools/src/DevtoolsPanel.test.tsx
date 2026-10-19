/** The panel end to end against a real `<SceneCanvas>` and the hook it installs, over an in-page connection. */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PanelMessage, PanelTransport } from '@weasel-js/core/devtools-protocol';
import type { DispatchRecord } from '@weasel-js/core/routing';
import { DevtoolsPanel } from './DevtoolsPanel';
import { createInPagePanelTransport } from './inPageTransport';
import { TestCanvas, rootByLabel, stubWebGL } from './testing/mountCanvas';

beforeAll(stubWebGL);
afterEach(cleanup);

/** An in-page transport that also keeps what the panel sent. */
function recordingTransport() {
  const inner = createInPagePanelTransport();
  const sent: PanelMessage[] = [];
  const transport: PanelTransport = {
    send: (m) => { sent.push(m); inner.send(m); },
    onMessage: (l) => inner.onMessage(l),
  };
  return { transport, sent, sentOfType: (type: string) => sent.filter((m) => m.type === type) };
}

function mount(opts: { tabs?: Parameters<typeof DevtoolsPanel>[0]['tabs'] } = {}) {
  const t = recordingTransport();
  const view = render(
    <>
      <TestCanvas />
      <DevtoolsPanel transport={t.transport} tabs={opts.tabs} />
    </>,
  );
  return { ...t, view, root: () => rootByLabel('board') };
}

const row = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });
/** Long enough for the notices of a frame or two to arrive. */
const settle = () => new Promise<void>((r) => { setTimeout(r, 50); });
const openBranch = (name: string) => fireEvent.keyDown(row(name), { key: 'ArrowRight' });

function dispatchRecord(ts: number, fired: string | null): DispatchRecord {
  const candidate = {
    actionId: fired ?? 'none', routes: ['[*:*] click'], scope: 'ambient' as const, ownerId: 'select',
    namesView: false, specificity: [0, 0, 0, 1] as const,
  };
  return {
    kind: 'dispatch', ts,
    input: { eventKind: 'pointerdown', modifiers: { alt: false, ctrl: false, meta: false, shift: false }, viewId: null },
    matched: fired ? [candidate] : [],
    dropped: [],
    ranked: fired ? [{ candidate, placedBy: { step: 'first' }, walk: { kind: 'fired' } }] : [],
    predicted: false,
    fired,
    outcome: fired ? 'handled' : 'unhandled',
  };
}

describe('DevtoolsPanel', () => {
  it('names the canvas it reads, with its dimension', async () => {
    mount();
    expect(await screen.findByRole('button', { name: /board\s*2d/ })).toBeTruthy();
  });

  it('lists the top level of the scene, each row with its kind, layer and child count', async () => {
    mount();
    const group = await waitFor(() => row('group'));
    expect(group.textContent).toMatch(/container\s*main\s*1/);
    expect(row('solo').textContent).toMatch(/leaf\s*main/);
  });

  it('asks for a branch only when it is opened', async () => {
    const t = mount();
    await waitFor(() => row('group'));
    expect(t.sentOfType('get-children').some((m) => 'nodeId' in m && m.nodeId === 'group')).toBe(false);
    openBranch('group');
    const inner = await waitFor(() => row('inner'));
    expect(t.sentOfType('get-children').some((m) => 'nodeId' in m && m.nodeId === 'group')).toBe(true);
    expect(inner.textContent).toMatch(/locked/);
  });

  it('asks again only about the areas a change notice names', async () => {
    const t = mount();
    await waitFor(() => row('solo'));
    await act(settle);
    const before = t.sentOfType('get-children').length;
    act(() => { t.root().source.setTool('hand'); });
    await waitFor(() => expect(t.root().source.activeTool()).toBe('hand'));
    await act(settle);
    expect(t.sentOfType('get-children')).toHaveLength(before);
    act(() => { t.root().source.scene()!.remove('solo' as never); });
    await waitFor(() => expect(t.sentOfType('get-children').length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: /^solo\b/ })).toBeNull());
  });

  it('shows a picked node: parent, pose and data, a function as its name', async () => {
    mount();
    await waitFor(() => row('group'));
    openBranch('group');
    fireEvent.click(await waitFor(() => row('inner')).then((r) => r.firstElementChild as HTMLElement));
    const data = await screen.findByRole('group', { name: 'Data' });
    expect(data.textContent).toContain('ƒ paint');
    expect(screen.getByRole('group', { name: 'Pose' }).textContent).toMatch(/width\s*10/);
    expect(screen.getByRole('button', { name: 'Show parent group' })).toBeTruthy();
  });

  it('selects the picked node on the canvas', async () => {
    const t = mount();
    fireEvent.click((await waitFor(() => row('solo'))).firstElementChild as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'Select on canvas' }));
    await waitFor(() => expect(t.root().source.selection()).toEqual(['solo']));
  });

  it('outlines the hovered row on the canvas, and stops when the panel unmounts', async () => {
    const t = mount();
    const solo = await waitFor(() => row('solo'));
    fireEvent.pointerOver(solo.firstElementChild as HTMLElement);
    await waitFor(() => expect(t.root().source.overlays()?.highlight).toEqual(['solo']));
    t.view.rerender(<TestCanvas />);
    await waitFor(() => expect(t.root().source.overlays()).toBeNull());
    expect(t.sentOfType('bye')).toHaveLength(1);
  });

  it('sets the active tool and the overlay flags from the State tab', async () => {
    const t = mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'State' }));
    const bounds = await screen.findByRole('switch', { name: 'bounds' });
    fireEvent.click(bounds);
    await waitFor(() => expect(t.root().source.overlays()?.bounds).toBe(true));
    await waitFor(() => expect((screen.getByRole('switch', { name: 'bounds' }) as HTMLInputElement).checked).toBe(true));
    const tools = t.root().source.tools();
    const other = tools.find((id) => id !== t.root().source.activeTool());
    expect(other).toBeDefined();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Active tool/ })); });
    fireEvent.click(await screen.findByRole('option', { name: other! }));
    await waitFor(() => expect(t.root().source.activeTool()).toBe(other));
  });

  it('lists every overlay flag the kit has, none hard-coded', async () => {
    const { DEBUG_FEATURES } = await import('@weasel-js/core');
    mount({ tabs: ['state'] });
    for (const flag of DEBUG_FEATURES) expect(await screen.findByRole('switch', { name: flag })).toBeTruthy();
  });

  it('follows the dispatch trace, hiding unhandled inputs until asked, and opens a decision', async () => {
    const t = mount({ tabs: ['dispatch'] });
    await screen.findByRole('switch', { name: 'coords' });
    act(() => {
      t.root().source.trace.push(dispatchRecord(1000, 'select.click'));
      t.root().source.trace.push(dispatchRecord(1001, null));
      t.root().source.trace.recordModeSwitch('editAnchors', null, 'node-1');
    });
    expect(await screen.findByText('select.click')).toBeTruthy();
    expect(screen.getByText('editAnchors')).toBeTruthy();
    expect(screen.queryByRole('cell', { name: 'unhandled' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'unhandled' }));
    expect(await screen.findByRole('cell', { name: 'unhandled' })).toBeTruthy();
    fireEvent.click(screen.getByText('select.click'));
    expect(await screen.findByLabelText('Decision path')).toBeTruthy();
  });

  it('shows coord records only behind their toggle', async () => {
    const t = mount({ tabs: ['dispatch'] });
    const coords = await screen.findByRole('switch', { name: 'coords' });
    const record = { ts: Date.now(), clientX: 12, clientY: 34, rect: null, view: null, world: { x: 1.5, y: 2.5 }, fallback: true };
    act(() => { t.root().source.coords.push(record); });
    await act(settle);
    expect(screen.queryByRole('region', { name: 'Coord records' })).toBeNull();
    expect(t.sent.some((m) => m.type === 'get-trace' && m.coordCursor !== undefined)).toBe(false);
    fireEvent.click(coords);
    const table = await screen.findByRole('region', { name: 'Coord records' });
    await waitFor(() => expect(table.textContent).toMatch(/12\.0\s+34\.0/));
  });

  it('polls frame stats only while the Frame tab is open and the fps overlay on', async () => {
    const t = mount({ tabs: ['scene', 'frame'] });
    await waitFor(() => row('solo'));
    expect(t.sentOfType('get-frame')).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Frame' }));
    const fps = await screen.findByRole('switch', { name: 'fps overlay' });
    expect(t.sentOfType('get-frame')).toHaveLength(0);
    fireEvent.click(fps);
    await waitFor(() => expect(t.sentOfType('get-frame').length).toBeGreaterThan(0));
  });

  it('says so when the page has no canvas left', async () => {
    const t = recordingTransport();
    const view = render(<><TestCanvas /><DevtoolsPanel transport={t.transport} /></>);
    await waitFor(() => row('solo'));
    view.rerender(<DevtoolsPanel transport={t.transport} />);
    expect(await screen.findByText('No canvas on this page.')).toBeTruthy();
  });
});
