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
    render(<ParamPanel doc={withBlur} selected="blur" change={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'radius' });
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('50');
  });

  it('sets the param through change, formatted, labeled "Set radius"', () => {
    const change = vi.fn();
    render(<ParamPanel doc={withBlur} selected="blur" change={change} />);
    fireEvent.change(screen.getByRole('slider', { name: 'radius' }), { target: { value: '12' } });
    expect(change).toHaveBeenCalledTimes(1);
    const [next, label] = change.mock.calls[0]!;
    expect(label).toBe('Set radius');
    const radius = (next as EffectDoc).pipeline.stages[0]!.params![0]!;
    expect(radius.value).toBe('12 px');
    expect(radius.control).toMatchObject({ kind: 'number', value: 12, min: 0, max: 50 });
  });

  it('shows a param without a control read-only', () => {
    const doc = addStage(EMPTY, { id: 'odd', title: 'Odd', params: [{ label: 'size', value: '3 px' }] });
    render(<ParamPanel doc={doc} selected="odd" change={() => {}} />);
    expect(screen.getByRole('status', { name: 'size' }).textContent).toBe('3 px');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('offers an enum param as a select', () => {
    const doc = addStage(EMPTY, stageFromType(typeOf('composite'), 'comp'));
    const change = vi.fn();
    render(<ParamPanel doc={doc} selected="comp" change={change} />);
    // The select's trigger is named for its value then its label.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /blend/ }));
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Screen' }));
    const [next, label] = change.mock.calls[0]!;
    expect(label).toBe('Set blend');
    expect((next as EffectDoc).pipeline.stages[0]!.params![0]!.value).toBe('Screen');
  });

  it("shows a picked group's name, renamed through change as 'Rename group'", () => {
    const doc: EffectDoc = { ...withBlur, pipeline: { ...withBlur.pipeline, groups: [{ id: 'g', label: 'Filters', members: ['blur'] }] } };
    const change = vi.fn();
    render(<ParamPanel doc={doc} selected={null} group="g" change={change} />);
    const name = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(name.value).toBe('Filters');
    fireEvent.change(name, { target: { value: 'Blurs' } });
    fireEvent.blur(name);
    const [next, label] = change.mock.calls[0]!;
    expect(label).toBe('Rename group');
    expect((next as EffectDoc).pipeline.groups).toEqual([{ id: 'g', label: 'Blurs', members: ['blur'] }]);
  });

  it('says to pick a stage when none is selected', () => {
    render(<ParamPanel doc={withBlur} selected={null} change={() => {}} />);
    expect(screen.getByText('Select a stage to edit its params.')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
