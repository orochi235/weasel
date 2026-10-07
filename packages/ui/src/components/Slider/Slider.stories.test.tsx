import { Profiler, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// The Playground writes its thumb count back through `useArgs`; a host component stands in for forge.
let updateArgs: (patch: { thumbCount: number }) => void = () => {};
vi.mock('@weasel-js/forge/preview-api', () => ({ useArgs: () => [{}, (patch: { thumbCount: number }) => updateArgs(patch)] }));

const { default: meta, Playground } = await import('./Slider.stories');

describe('Slider Playground story', () => {
  it('never commits a thumb count the slider has not caught up with', () => {
    let count = 3;
    const seen: [number, number][] = [];
    function Host() {
      const [thumbCount, setThumbCount] = useState(3);
      updateArgs = (patch) => setThumbCount(patch.thumbCount);
      count = thumbCount;
      const args = { ...meta.args, ...Playground.args, thumbCount } as never;
      return <>{Playground.render!(args, {} as never)}</>;
    }
    render(
      <Profiler id="playground" onRender={() => { seen.push([count, screen.queryAllByRole('slider').length]); }}>
        <Host />
      </Profiler>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(seen.filter(([want, got]) => want !== got)).toEqual([]);
  });
});
