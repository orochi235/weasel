import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Slider } from './Slider';
import { stubRect } from './testing/stubRect';
import type { Thumb } from './types';

// The edit protocol, docs/conventions.md "Edit callbacks", as Slider keeps it.

function setup(ui: React.ReactElement) {
  const r = render(ui);
  const thumb = () => r.container.querySelector<HTMLElement>('[role="slider"]')!;
  stubRect(thumb().parentElement!, { left: 0, width: 200 });
  const press = (x = 100) => fireEvent.pointerDown(thumb(), { clientX: x, clientY: 12, pointerId: 1, button: 0 });
  const move = (x: number) => fireEvent.pointerMove(document, { clientX: x, clientY: 12, pointerId: 1 });
  const release = (x: number) => fireEvent.pointerUp(document, { clientX: x, clientY: 12, pointerId: 1 });
  return { ...r, thumb, press, move, release };
}

describe('Slider edit protocol', () => {
  it('a commit-only consumer sees the drag and gets one commit at its end', () => {
    const onChange = vi.fn();
    const { thumb, press, move, release } = setup(
      <Slider min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onChange={onChange} />,
    );
    press();
    move(130);
    move(150);
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.75');
    expect(onChange).not.toHaveBeenCalled();
    release(150);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].value).toBeCloseTo(0.75, 2);
    // The draft is gone: the slider draws the prop, which this consumer never wrote.
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.5');
  });

  it('commits once per drag however many moves it has, and never for a press that changed nothing', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { press, move, release } = setup(
      <Slider min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onInput={onInput} onChange={onChange} />,
    );
    press();
    for (let x = 101; x < 160; x += 3) move(x);
    release(160);
    expect(onChange).toHaveBeenCalledTimes(1);

    press();
    release(100);
    press();
    move(140);
    move(100);
    release(100);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a key step is one edit: a preview and its commit', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { thumb } = setup(<Slider min={0} max={10} step={1} thumbs={[{ value: 5 }]} onInput={onInput} onChange={onChange} />);
    fireEvent.keyDown(thumb(), { key: 'ArrowRight' });
    fireEvent.keyDown(thumb(), { key: 'End' });
    expect(onChange.mock.calls.map(c => c[0][0].value)).toEqual([6, 10]);
    expect(onInput.mock.calls.map(c => c[0][0].value)).toEqual([6, 10]);
  });

  it('Escape cancels a drag: the preview goes back, onCancel fires, nothing commits', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const { thumb, press, move, release } = setup(
      <Slider min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onInput={onInput} onChange={onChange} onCancel={onCancel} />,
    );
    press();
    move(150);
    fireEvent.keyDown(thumb(), { key: 'Escape' });
    expect(onInput.mock.calls.at(-1)![0][0].value).toBe(0.5);
    expect(onCancel).toHaveBeenCalledTimes(1);
    release(150);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Escape drops a commit-only consumer\'s draft', () => {
    const onChange = vi.fn();
    const { thumb, press, move } = setup(<Slider min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onChange={onChange} />);
    press();
    move(150);
    fireEvent.keyDown(thumb(), { key: 'Escape' });
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws what the consumer normalized a preview to', () => {
    const commits: number[] = [];
    function Clamped() {
      const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 0.5 }]);
      const norm = (next: Thumb[]) => next.map(t => ({ ...t, value: Math.min(t.value, 0.6) }));
      return (
        <Slider
          min={0} max={1} step={0.01} thumbs={thumbs}
          onInput={next => setThumbs(norm(next))}
          onChange={next => { const n = norm(next); commits.push(n[0].value); setThumbs(n); }}
        />
      );
    }
    const { thumb, press, move, release } = setup(<Clamped />);
    press();
    move(180);
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.6');
    release(180);
    expect(commits).toEqual([0.6]);
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.6');
  });

  it('draws what a commit-only consumer normalized the commit to', () => {
    function Rounded() {
      const [v, setV] = useState(0.5);
      return <Slider min={0} max={1} step={0.01} thumbs={[{ value: v }]} onChange={next => setV(Math.round(next[0].value * 4) / 4)} />;
    }
    const { thumb, press, move, release } = setup(<Rounded />);
    press();
    move(132);
    release(132);
    expect(thumb().getAttribute('aria-valuenow')).toBe('0.75');
  });
});
