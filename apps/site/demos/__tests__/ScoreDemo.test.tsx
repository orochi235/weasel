import { describe, it, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { SCORE_CUES } from '@weasel-js/audio';
import { ScoreDemo } from '../ScoreDemo';

const reading = (container: HTMLElement, label: string): string =>
  within(container).getByText(label, { selector: 'dt' }).nextElementSibling!.textContent!;

describe('ScoreDemo', () => {
  it('names the cue its sliders start on, and the device that cue applies', () => {
    const { container, getByTestId } = render(<ScoreDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(getByTestId('cue').textContent).toBe('investigation');
    expect(getByTestId('device').textContent).toBe(SCORE_CUES.find((c) => c.name === 'investigation')!.device);
  });

  it('moves every slider to a cue when that cue is picked, and shows its parameters', () => {
    const { container, getByRole, getByTestId, getByLabelText } = render(<ScoreDemo />);
    fireEvent.click(getByRole('radio', { name: 'dread' }));
    expect(getByTestId('cue').textContent).toBe('dread');
    expect(getByRole('radio', { name: 'dread' }).getAttribute('aria-checked')).toBe('true');
    expect((getByLabelText('valence') as HTMLInputElement).value).toBe('-1');
    expect(reading(container, 'mode')).toBe('phrygian');
    expect(reading(container, 'harmony')).toBe('cluster');
    expect(reading(container, 'tempo')).toBe(' 60 bpm');
    expect(reading(container, 'dread')).toBe('100%');
  });

  it('reads the parameters and the cue off a slider as it moves', () => {
    const { container, getByLabelText, getByTestId, getByRole } = render(<ScoreDemo />);
    fireEvent.click(getByRole('radio', { name: 'dread' }));
    fireEvent.change(getByLabelText('urgency'), { target: { value: '1' } });
    expect(reading(container, 'tempo')).toBe('140 bpm');
    expect(reading(container, 'articulation')).toBe('plucked');
    expect(getByTestId('cue').textContent).toBe('urgency');
    expect(getByRole('radio', { name: 'dread' }).getAttribute('aria-checked')).toBe('false');
  });
});
