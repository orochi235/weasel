import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlotMeasure } from './measure';
import type { PieData } from './pie/types';
import { PlotView } from './PlotView';

const PIE: PieData = { kind: 'pie', title: 'Pets', slices: [{ label: 'Dogs', value: 3 }, { label: 'Cats', value: 2 }] };
const measure: PlotMeasure = (text) => ({ width: text.length * 7, height: 14 });

describe('PlotView', () => {
  it('reports no edit when its data comes from props', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PlotView data={PIE} onChange={onChange} width={400} height={300} measure={measure} />);
    rerender(<PlotView data={{ ...PIE, title: 'Animals' }} onChange={onChange} width={400} height={300} measure={measure} />);
    rerender(<PlotView data={{ ...PIE, title: 'Animals' }} onChange={onChange} width={500} height={300} measure={measure} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('redraws with a new measure', () => {
    const { rerender } = render(<PlotView data={PIE} width={400} height={300} measure={measure} />);
    const wider = vi.fn<PlotMeasure>((text) => ({ width: text.length * 9, height: 14 }));
    rerender(<PlotView data={PIE} width={400} height={300} measure={wider} />);
    expect(wider).toHaveBeenCalled();
  });
});
