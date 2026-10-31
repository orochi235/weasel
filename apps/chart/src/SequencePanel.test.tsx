import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { createScene, type Tool, type ToolsApi } from '@weasel-js/core';
import { findStep, sequenceRootOf, sequenceSpecs, sequenceTools, type SequenceData } from '@weasel-js/diagram';
import { CHART_LAYERS, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { isSequenceTool, SequencePanel, type SequenceChoices } from './SequencePanel';
import { renderWithIcons } from './testIcons';

afterEach(cleanup);

const DATA: SequenceData = {
  participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  steps: [
    { kind: 'message', id: 'm1', from: 'a', to: 'b', text: 'hi', line: 'solid', head: 'arrow' },
    { kind: 'fragment', id: 'f1', type: 'alt', sections: [{ label: 'ok', steps: [{ kind: 'message', id: 'm2', from: 'b', to: 'a', line: 'dashed', head: 'arrow' }] }] },
    { kind: 'message', id: 'm3', from: 'b', to: 'c', line: 'solid', head: 'arrow' },
  ],
};

function chartTools(): ToolsApi {
  const list: Tool[] = [{ id: 'select', presentation: { label: 'Select' } } as Tool, ...Object.values(sequenceTools())];
  return { active: null, setActive: vi.fn(), registry: Object.fromEntries(list.map((t) => [t.id, t])) } as unknown as ToolsApi;
}

const sceneOf = (withSequence = true) => createScene<ChartData, ChartLayer, ChartPose>({
  systemLayers: CHART_LAYERS, registry: CHART_REGISTRY,
  ...(withSequence ? { initial: sequenceSpecs(DATA, { id: 'seq', layer: 'shapes' }) as never } : {}),
});
type Scene = ReturnType<typeof sceneOf>;

const CHOICES: SequenceChoices = { participant: 'participant', arrow: 'sync', fragment: 'loop', mark: 'activate' };

/** The panel over `scene`, drawn again on every change to it, as the workspace does. */
function panel(scene: Scene, selected: string[] = []) {
  act(() => scene.setSelection(selected as never));
  const ui = () => (
    <SequencePanel tools={chartTools()} scene={scene} selected={scene.getSelection() as readonly string[]} choices={CHOICES} onChoose={() => {}} />
  );
  const view = renderWithIcons(ui());
  scene.subscribe(() => view.rerender(ui()));
  return view;
}

const dataOf = (scene: Scene) => sequenceRootOf(scene.get('seq' as never)!)!.sequence;

/** Opens the select whose trigger `name` matches and picks `option`. */
function pick(name: RegExp, option: string): void {
  act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  act(() => { fireEvent.click(screen.getByRole('option', { name: option })); });
}
const press = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });

describe('SequencePanel', () => {
  it('holds the sequence tools, open when the chart holds a sequence', () => {
    panel(sceneOf());
    const buttons = [...screen.getByRole('toolbar', { name: 'Sequence tools' }).querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Participant', 'Message', 'Note', 'Fragment', 'Mark']);
  });

  it('starts folded on a chart with no sequence, and opens from its title', () => {
    panel(sceneOf(false));
    expect(screen.queryByRole('toolbar', { name: 'Sequence tools' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Sequence/ }));
    expect(screen.getByRole('toolbar', { name: 'Sequence tools' })).toBeTruthy();
  });

  it('tells its tools from the main palette\'s', () => {
    expect(Object.values(sequenceTools()).every(isSequenceTool)).toBe(true);
    expect(isSequenceTool({ id: 'select' } as Tool)).toBe(false);
  });

  it('retypes a selected message\'s arrow as one undo entry, keeping it selected', () => {
    const scene = sceneOf();
    panel(scene, ['seq/msg:m1']);
    const before = scene.historyIndex();
    pick(/Arrow/, 'Reply');
    expect(findStep(dataOf(scene).steps, 'm1')).toMatchObject({ line: 'dashed', head: 'arrow' });
    expect(scene.historyIndex()).toBe(before + 1);
    expect(scene.getSelection()).toEqual(['seq/msg:m1']);
    act(() => { scene.undo(); });
    expect(findStep(dataOf(scene).steps, 'm1')).toMatchObject({ line: 'solid' });
  });

  it('sets where a selected message starts and ends an activation', () => {
    const scene = sceneOf();
    panel(scene, ['seq/msg:m1']);
    pick(/Activates/, 'Receiver');
    pick(/Deactivates/, 'Sender');
    expect(findStep(dataOf(scene).steps, 'm1')).toMatchObject({ activate: 'to', deactivate: 'from' });
    pick(/Activates/, 'Neither');
    expect('activate' in findStep(dataOf(scene).steps, 'm1')!).toBe(false);
  });

  it('adds and removes a selected alt\'s sections, and retypes it', () => {
    const scene = sceneOf();
    panel(scene, ['seq/frag:f1']);
    press('Add section');
    expect(findStep(dataOf(scene).steps, 'f1')).toMatchObject({ sections: [{ label: 'ok' }, { steps: [] }] });
    pick(/. Fragment/, 'Par');
    expect(findStep(dataOf(scene).steps, 'f1')).toMatchObject({ type: 'par' });
    press('Remove section');
    expect(findStep(dataOf(scene).steps, 'f1')).toMatchObject({ sections: [{ label: 'ok' }] });
    expect(screen.getByRole('button', { name: 'Remove section' }).hasAttribute('disabled')).toBe(true);
  });

  it('boxes selected participants and removes the box, and retypes a selected head', () => {
    const scene = sceneOf();
    panel(scene, ['seq/head:a', 'seq/head:b']);
    press('Box participants');
    expect(dataOf(scene).boxes).toEqual([{ id: 'b1', members: ['a', 'b'] }]);
    press('Remove box');
    expect(dataOf(scene).boxes).toBeUndefined();
    pick(/Adds/, 'Actor');
    expect(dataOf(scene).participants.slice(0, 2).map((p) => p.outline)).toEqual(['actor', 'actor']);
  });

  it('numbers the only sequence\'s messages with nothing selected', () => {
    const scene = sceneOf();
    panel(scene);
    act(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'Number messages' })); });
    expect(dataOf(scene).autonumber).toBe(1);
    act(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'Number messages' })); });
    expect(dataOf(scene).autonumber).toBeUndefined();
  });
});
