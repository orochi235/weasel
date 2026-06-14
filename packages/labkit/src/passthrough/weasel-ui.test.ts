import { describe, expect, it } from 'vitest';
import {
  Button,
  Checkbox,
  ComboBox,
  CurveEditor,
  Dialog,
  Field,
  Input,
  KeyCap,
  MINUS_SIGN,
  NumberField,
  Plot2D,
  PointPlotter,
  RadioGroup,
  RangeSlider,
  Select,
  Sidebar,
  Slider,
  Switch,
  Tabs,
  ToolPalette,
  chromaAt,
  formatNumber,
  oklchToHex,
  paintGradientTrack,
  useReorderDragList,
} from './weasel-ui';

describe('weasel-ui passthrough', () => {
  it('re-exports formatNumber with MINUS_SIGN convention', () => {
    expect(formatNumber(-3.14)).toBe(`${MINUS_SIGN}3.14`);
  });

  it('re-exports utility functions', () => {
    expect(typeof useReorderDragList).toBe('function');
    expect(typeof paintGradientTrack).toBe('function');
    expect(typeof oklchToHex).toBe('function');
    expect(typeof chromaAt).toBe('function');
  });

  it('re-exports form primitives as React components', () => {
    for (const C of [
      Button,
      Checkbox,
      ComboBox,
      Dialog,
      Field,
      Input,
      NumberField,
      RadioGroup,
      RangeSlider,
      Select,
      Slider,
      Switch,
      Tabs,
    ]) {
      expect(C).toBeDefined();
      // React components are either plain functions or forwardRef/memo objects
      expect(['function', 'object']).toContain(typeof C);
    }
  });

  it('re-exports plot / curve primitives as React components', () => {
    for (const C of [CurveEditor, Plot2D, PointPlotter]) {
      expect(C).toBeDefined();
      // React components are either plain functions or forwardRef/memo objects
      expect(['function', 'object']).toContain(typeof C);
    }
  });

  it('re-exports app-chrome primitives as React components', () => {
    for (const C of [Sidebar, ToolPalette, KeyCap]) {
      expect(C).toBeDefined();
      // React components are either plain functions or forwardRef/memo objects
      expect(['function', 'object']).toContain(typeof C);
    }
  });
});
