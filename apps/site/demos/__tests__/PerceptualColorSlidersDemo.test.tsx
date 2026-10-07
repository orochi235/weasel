import { Profiler } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PerceptualColorSlidersDemo } from '../PerceptualColorSlidersDemo';

// Hue, the two L thumbs, then the three chroma thumbs.
const values = () => screen.getAllByRole('slider').slice(0, 6).map((el) => el.getAttribute('aria-valuenow'));
const pick = (mode: string) => {
  fireEvent.click(screen.getAllByRole('radio', { name: mode }).find((el) => el instanceof HTMLInputElement)!);
};

describe('PerceptualColorSlidersDemo', () => {
  it('clamps the sliders into a tighter bounds mode in the commit that selects it', () => {
    let commits = 0;
    render(
      <Profiler id="demo" onRender={() => { commits++; }}>
        <PerceptualColorSlidersDemo />
      </Profiler>,
    );
    expect(values()).toEqual(['200', '0.16', '0.97', '0.04', '0.16', '0.08']);
    const before = commits;
    pick('conservative');
    expect(commits - before).toBe(1);
    expect(values()).toEqual(['200', '0.16', '0.9', '0.03', '0.11', '0.05']);
  });

  it('leaves the sliders where they are when the mode loosens', () => {
    render(<PerceptualColorSlidersDemo />);
    pick('conservative');
    pick('unconstrained');
    expect(values()).toEqual(['200', '0.16', '0.9', '0.03', '0.11', '0.05']);
  });
});
