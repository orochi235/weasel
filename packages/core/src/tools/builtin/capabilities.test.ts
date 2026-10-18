import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as builtins from './index';
import { createMeasurements } from 'features/measure/measurements';

// Hooks here are pure factories at top level — we instantiate each by
// calling its hook in a renderHook environment with a minimal set of
// required args, and read .capabilities off the returned Tool.
//
// Where a hook takes required options, we pass the smallest set that
// satisfies the type — the test only checks the tag string. If a hook's
// signature changes later, this test will fail at the renderHook call
// site and the engineer updates the option literal.

describe('built-in tool capabilities', () => {
  const cases: Array<[string, () => { eligibility?: { capabilities?: readonly string[] } } | null, readonly string[]]> = [
    ['hand', () => builtins.useHandTool({}), ['navigation']],
    ['select', () => builtins.useSelectTool({} as never, {} as never), ['creates-selection']],
    ['lasso', () => builtins.useLassoTool(), ['creates-selection']],
    ['rect', () => builtins.useRectTool(), ['creates-shapes']],
    ['ellipse', () => builtins.useEllipseTool(), ['creates-shapes']],
    ['line', () => builtins.useLineTool(), ['creates-shapes']],
    ['star', () => builtins.useStarTool({} as never), ['creates-shapes']],
    ['polygon', () => builtins.usePolygonTool({} as never), ['creates-shapes']],
    ['pen', () => {
      return builtins.usePenTool() as unknown as { eligibility?: { capabilities?: readonly string[] } };
    }, ['creates-paths']],
    ['pencil', () => builtins.usePencilTool(), ['creates-paths']],
    ['slice', () => builtins.useSliceTool(), ['edits-page']],
    ['measure', () => builtins.useMeasureTool({ measurements: createMeasurements({ layer: 'notes' }) }), ['navigation']],
    ['weight', () => builtins.useWeightTool({ scene: {} as never, rig: () => null }), ['edits-page']],
    ['bone', () => builtins.useBoneTool({ scene: {} as never, rig: () => null }), ['edits-page']],
    ['text', () => builtins.useTextTool(), ['creates-text']],
    ['sticky', () => builtins.useStickyTool(), ['creates-text']],
    ['eyedropper', () => builtins.useEyedropperTool({} as never), ['samples-color']],
  ];

  for (const [name, hook, expected] of cases) {
    it(`${name} declares capabilities: [${expected.join(', ')}]`, () => {
      const { result } = renderHook(hook);
      const tool = (result.current && typeof result.current === 'object' && 'tool' in result.current)
        ? (result.current as { tool: { eligibility?: { capabilities?: readonly string[] } } }).tool
        : (result.current as { eligibility?: { capabilities?: readonly string[] } } | null);
      expect(tool?.eligibility?.capabilities).toEqual(expected);
    });
  }
});
