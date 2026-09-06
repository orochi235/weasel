/**
 * `annotations.targets` is declared once per instrument and called once per
 * trial, so everything here runs two trials of one instrument: with a single
 * trial open, a `targets` that ignored the trial it was asked about would look
 * identical.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnnotationTarget } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import type { TrialInfo } from '../state/types';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const asked: TrialInfo[] = [];

/** The last thing `targets` was told about `id`. */
function lastAsk(id: string): TrialInfo {
  const found = [...asked].reverse().find((t) => t.id === id);
  if (!found) throw new Error(`targets was never called for ${id}`);
  return found;
}

const pane: AnnotationTarget = { id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } };

const subject = defineInstrument<Record<string, never>, { subject: string }>({
  name: 'Subject',
  defaultConfig: () => ({ subject: 'none' }),
  initialState: () => ({}),
  render: (ctx) => (
    <button
      type="button"
      data-testid={`zoom-${ctx.trial.id}`}
      onClick={() => ctx.trial.setView({ zoom: 3, pan: { x: 0, y: 0 } })}
    >
      zoom
    </button>
  ),
  annotations: {
    targets: (_state, _config, trial) => {
      asked.push({ id: trial.id, view: trial.view });
      return [pane];
    },
  },
});

let labRef: LabContextValue | null = null;

function CaptureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        if (value) labRef = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

function mountTwoTrials(): [string, string] {
  render(
    <Lab instruments={[subject]} defaultInstrument="Subject">
      <CaptureLab />
    </Lab>,
  );
  act(() => labRef?.addTrial('Subject'));
  const ids = labRef?.trials.map((t) => t.id) ?? [];
  const [a, b] = ids;
  if (!a || !b) throw new Error('expected two trials');
  return [a, b];
}

describe('annotations.targets', () => {
  beforeEach(() => {
    asked.length = 0;
    labRef = null;
  });

  it('is told which trial is asking', () => {
    const [a, b] = mountTwoTrials();
    expect(new Set(asked.map((t) => t.id))).toEqual(new Set([a, b]));
  });

  it("is told that trial's own view, not the other's", () => {
    const [a, b] = mountTwoTrials();
    fireEvent.click(screen.getByTestId(`zoom-${a}`));
    expect(lastAsk(a).view).toEqual({ zoom: 3, pan: { x: 0, y: 0 } });
    expect(lastAsk(b).view).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });
});
