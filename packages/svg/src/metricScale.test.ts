import { describe, expect, it } from 'vitest';
import { scaleStroke } from './metricScale';

describe('scaleStroke', () => {
  it('scales a stroke with no width from the default width of 1, with its dashes', () => {
    expect(scaleStroke({ dash: [4, 2] }, 2)).toMatchObject({ width: 2, dash: [8, 4] });
  });

  it('leaves a stroke alone at a scale of 1', () => {
    const stroke = { dash: [4, 2] };
    expect(scaleStroke(stroke, 1)).toBe(stroke);
  });
});
