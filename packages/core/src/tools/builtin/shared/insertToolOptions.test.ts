import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as builtins from '../index';
import { snapToGrid } from 'interactions/actions/insert/behaviors/snapToGrid';
import type { InsertToolOptions } from './insertToolOptions';

type InsertTool = { bindings?: readonly { actionId: string; opts?: { behaviors?: unknown[] } }[] };

const tools: Array<[string, (o: InsertToolOptions) => unknown]> = [
  ['rect', (o) => builtins.useRectTool(o)],
  ['ellipse', (o) => builtins.useEllipseTool(o)],
  ['line', (o) => builtins.useLineTool(o)],
  ['polygon', (o) => builtins.usePolygonTool(o)],
  ['star', (o) => builtins.useStarTool(o)],
  ['pencil', (o) => builtins.usePencilTool(o)],
  ['text', (o) => builtins.useTextTool(o)],
  ['image', (o) => builtins.useImageTool({ src: 'a.png', ...o })],
];

describe('drag-to-insert tools carry their behaviors onto the insert binding', () => {
  const behaviors = [snapToGrid({ spacing: 10 })];
  for (const [name, hook] of tools) {
    it(name, () => {
      const { result } = renderHook(() => hook({ behaviors }));
      const insert = (result.current as InsertTool).bindings?.find((b) => b.actionId === 'insert');
      expect(insert?.opts?.behaviors).toEqual(behaviors);
    });
  }
});
