import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as builtins from './index';

// Hooks here are pure factories at top level — we instantiate each by
// calling its hook in a renderHook environment with a minimal set of
// required args, and read .capabilities off the returned Tool.
//
// Where a hook takes required options, we pass the smallest set that
// satisfies the type — the test only checks the tag string. If a hook's
// signature changes later, this test will fail at the renderHook call
// site and the engineer updates the option literal.
//
// NOTE: usePinchZoomTool is intentionally excluded. It is NOT a Tool factory
// — it is a side-effect hook with signature (canvasRef, view, setView, opts)
// that returns void. There is no Tool literal to attach capabilities to.
// It is tracked as DONE_WITH_CONCERNS in the implementation notes.

describe('built-in tool capabilities', () => {
  const cases: Array<[string, () => { capabilities?: readonly string[] } | null, readonly string[]]> = [
    ['hand', () => builtins.useHandTool({}), ['navigation']],
    ['select', () => builtins.useSelectTool({} as never, {} as never), ['creates-selection']],
    ['lasso', () => builtins.useLassoTool({} as never), ['creates-selection']],
    ['rect', () => builtins.useRectTool(), ['creates-shapes']],
    ['ellipse', () => builtins.useEllipseTool(), ['creates-shapes']],
    ['line', () => builtins.useLineTool(), ['creates-shapes']],
    ['star', () => builtins.useStarTool({} as never), ['creates-shapes']],
    ['polygon', () => builtins.usePolygonTool({} as never), ['creates-shapes']],
    ['pen', () => {
      // usePenTool requires adapter.applyOps at hook-call time (not just in
      // gesture handlers). Provide a minimal stub. Returns { tool, isEditing }
      // — extracted below via the 'tool' in guard.
      const minOpts = {
        wrapPath: () => ({}),
        adapter: { applyOps: () => {}, addNode: () => 'id', getNodes: () => [], getPose: () => ({}), getChildren: () => [], getParent: () => null },
        getPathObj: () => null,
      };
      return builtins.usePenTool(minOpts as never) as unknown as { capabilities?: readonly string[] };
    }, ['creates-paths']],
    ['pencil', () => builtins.usePencilTool(), ['creates-paths']],
    ['text', () => builtins.useTextTool(), ['creates-text']],
    ['eyedropper', () => builtins.useEyedropperTool({} as never), ['samples-color']],
    ['rotate', () => builtins.useRotateTool({} as never, {}), ['transforms-selection']],
  ];

  for (const [name, hook, expected] of cases) {
    it(`${name} declares capabilities: [${expected.join(', ')}]`, () => {
      const { result } = renderHook(hook);
      const tool = (result.current && typeof result.current === 'object' && 'tool' in result.current)
        ? (result.current as { tool: { capabilities?: readonly string[] } }).tool
        : (result.current as { capabilities?: readonly string[] } | null);
      expect(tool?.capabilities).toEqual(expected);
    });
  }
});
