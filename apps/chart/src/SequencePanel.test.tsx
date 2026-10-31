import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { createScene, type Tool, type ToolsApi } from '@weasel-js/core';
import { sequenceSpecs, sequenceTools } from '@weasel-js/diagram';
import { CHART_LAYERS, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { isSequenceTool, SequencePanel } from './SequencePanel';
import { renderWithIcons } from './testIcons';

afterEach(cleanup);

function chartTools(): ToolsApi {
  const list: Tool[] = [{ id: 'select', presentation: { label: 'Select' } } as Tool, ...Object.values(sequenceTools())];
  return { active: null, setActive: vi.fn(), registry: Object.fromEntries(list.map((t) => [t.id, t])) } as unknown as ToolsApi;
}

const sceneOf = (withSequence: boolean) => createScene<ChartData, ChartLayer, ChartPose>({
  systemLayers: CHART_LAYERS, registry: CHART_REGISTRY,
  ...(withSequence
    ? { initial: sequenceSpecs({ participants: [{ id: 'a' }], steps: [] }, { id: 'seq', layer: 'shapes' }) as never }
    : {}),
});

const CHOICES = { participant: 'participant', arrow: 'sync', fragment: 'loop' } as const;

describe('SequencePanel', () => {
  it('holds the sequence tools, open when the chart holds a sequence', () => {
    renderWithIcons(<SequencePanel tools={chartTools()} scene={sceneOf(true)} choices={CHOICES} onChoose={() => {}} />);
    const buttons = [...screen.getByRole('toolbar', { name: 'Sequence tools' }).querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Participant', 'Message', 'Note', 'Fragment']);
  });

  it('starts folded on a chart with no sequence, and opens from its title', () => {
    renderWithIcons(<SequencePanel tools={chartTools()} scene={sceneOf(false)} choices={CHOICES} onChoose={() => {}} />);
    expect(screen.queryByRole('toolbar', { name: 'Sequence tools' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Sequence/ }));
    expect(screen.getByRole('toolbar', { name: 'Sequence tools' })).toBeTruthy();
  });

  it('tells its tools from the main palette\'s', () => {
    expect(Object.values(sequenceTools()).every(isSequenceTool)).toBe(true);
    expect(isSequenceTool({ id: 'select' } as Tool)).toBe(false);
  });
});
