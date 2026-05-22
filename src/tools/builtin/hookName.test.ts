import { describe, expect, it } from 'vitest';
import * as Builtin from './index';

// Parity check between this list and the kit's barrel exports. The richer
// "def carries matching hookName" assertion lives in the swillustrator
// `registryProbe.test.tsx` because the def is only constructed inside a
// React render — calling these hooks at module scope would violate React's
// rules of hooks.
const HOOK_NAMES = [
  'useSelectTool',
  'useHandTool',
  'useRotateTool',
  'useRectTool',
  'useEllipseTool',
  'useLineTool',
  'usePolygonTool',
  'useStarTool',
  'usePenTool',
  'usePencilTool',
  'useLassoTool',
  'useTextTool',
  'useEyedropperTool',
  'usePinchZoomTool',
] as const;

describe('builtin tool hookName parity', () => {
  for (const name of HOOK_NAMES) {
    it(`${name} is exported from src/tools/builtin/index.ts`, () => {
      const hook = (Builtin as Record<string, unknown>)[name];
      expect(typeof hook).toBe('function');
    });
  }
});
