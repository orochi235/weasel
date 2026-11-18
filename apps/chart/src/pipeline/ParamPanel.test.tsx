import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IMAGE_STAGE_TYPES, addStage, stageFromType, type EffectDoc } from '@weasel-js/diagram/effect';
import { ParamPanel } from './ParamPanel';

afterEach(cleanup);

const typeOf = (t: string) => IMAGE_STAGE_TYPES.find((s) => s.type === t)!;
const EMPTY: EffectDoc = { pipeline: { stages: [], wires: [] }, places: {} };
const withBlur = addStage(EMPTY, stageFromType(typeOf('blur'), 'blur'));

describe('ParamPanel', () => {
  it("shows a Blur stage's radius as a slider bounded 0–50", () => {
    render(<ParamPanel doc={withBlur} selected="blur" change={() => {}} preview={() => {}} cancel={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'radius' });
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('50');
  });

  it('previews a slider drag through preview and records it through change, labeled "Set radius"', () => {
    const change = vi.fn();
    const preview = vi.fn();
    render(<ParamPanel doc={withBlur} selected="blur" change={change} preview={preview} cancel={() => {}} />);
    fireEvent.change(screen.getByRole('slider', { name: 'radius' }), { target: { value: '12' } });
    expect(preview).toHaveBeenCalled();
    expect(change).toHaveBeenCalledTimes(1);
    const [next, label] = change.mock.calls[0]!;
    expect(label).toBe('Set radius');
    const radius = (next as EffectDoc).pipeline.stages[0]!.params![0]!;
    expect(radius.value).toBe('12 px');
    expect(radius.control).toMatchObject({ kind: 'number', value: 12, min: 0, max: 50 });
  });

  it('shows a param without a control read-only', () => {
    const doc = addStage(EMPTY, { id: 'odd', title: 'Odd', params: [{ label: 'size', value: '3 px' }] });
    render(<ParamPanel doc={doc} selected="odd" change={() => {}} preview={() => {}} cancel={() => {}} />);
    expect(screen.getByRole('status', { name: 'size' }).textContent).toBe('3 px');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('offers an enum param as a select', () => {
    const doc = addStage(EMPTY, stageFromType(typeOf('composite'), 'comp'));
    const change = vi.fn();
    render(<ParamPanel doc={doc} selected="comp" change={change} preview={() => {}} cancel={() => {}} />);
    // The select's trigger is named for its value then its label.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /blend/ }));
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Screen' }));
    const [next, label] = change.mock.calls[0]!;
    expect(label).toBe('Set blend');
    expect((next as EffectDoc).pipeline.stages[0]!.params![0]!.value).toBe('Screen');
  });

  it("shows a picked cluster's name, renamed through change as 'Rename group'", () => {
    const doc: EffectDoc = { ...withBlur, pipeline: { ...withBlur.pipeline, clusters: [{ id: 'g', label: 'Filters', members: ['blur'] }] } };
    const change = vi.fn();
    render(<ParamPanel doc={doc} selected={null} cluster="g" change={change} preview={() => {}} cancel={() => {}} />);
    const name = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(name.value).toBe('Filters');
    fireEvent.change(name, { target: { value: 'Blurs' } });
    fireEvent.blur(name);
    const [next, label] = change.mock.calls[0]!;
    expect(label).toBe('Rename group');
    expect((next as EffectDoc).pipeline.clusters).toEqual([{ id: 'g', label: 'Blurs', members: ['blur'] }]);
  });

  it('says to pick a stage when none is selected', () => {
    render(<ParamPanel doc={withBlur} selected={null} change={() => {}} preview={() => {}} cancel={() => {}} />);
    expect(screen.getByText('Select a stage to edit its params.')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
