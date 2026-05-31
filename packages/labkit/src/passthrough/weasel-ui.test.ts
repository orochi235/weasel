import { describe, expect, it } from 'vitest';
import {
  CurveEditor,
  formatNumber,
  MINUS_SIGN,
  oklchToHex,
  paintGradientTrack,
  useReorderDragList,
} from './weasel-ui';

describe('weasel-ui passthrough', () => {
  it('re-exports formatNumber with MINUS_SIGN convention', () => {
    expect(formatNumber(-3.14)).toBe(`${MINUS_SIGN}3.14`);
  });

  it('re-exports CurveEditor as a React component', () => {
    expect(typeof CurveEditor).toBe('function');
  });

  it('re-exports the hook and helpers', () => {
    expect(typeof useReorderDragList).toBe('function');
    expect(typeof paintGradientTrack).toBe('function');
    expect(typeof oklchToHex).toBe('function');
  });
});
