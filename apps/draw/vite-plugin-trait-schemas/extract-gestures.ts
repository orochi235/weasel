/**
 * Extract `GestureSchema`s for the inspector's gesture catalog.
 *
 * The kit's `packages/core/src/interactions/gestures/types.ts` defines a few payload-bearing
 * types (`PointerState`, `GroupTransform`) but does not declare a payload alias
 * for every gesture id. For ids without a discoverable payload type we
 * fall back to a hand-encoded shape that matches the runtime dispatch.
 */
import { type Project } from 'ts-morph';
import { resolve } from 'node:path';
import type { GestureSchema, PropertyDescriptor, SourceRef } from '../src/dev/traitSchemas.types';
import { srcRef, sourceFileOrThrow, propertiesOfTypeNode } from './extract';

const GESTURE_IDS: readonly string[] = [
  'click', 'pointerDown', 'dblTap', 'drag', 'wheel',
  'keyDown', 'keyUp',
  'doubleClick', 'key', 'key-held', 'multiTouch', 'multiTouchTap', 'pointerdown',
];

type Found = { payload: readonly PropertyDescriptor[]; source?: SourceRef };

export function extractGestures(
  project: Project,
  repoRoot: string,
): Record<string, GestureSchema> {
  const typesPath = resolve(repoRoot, 'packages/core/src/interactions/gestures/types.ts');
  const sf = sourceFileOrThrow(project, typesPath);

  const pointer = sf.getInterface('PointerState') ?? sf.getTypeAlias('PointerState');
  const pointerProps = pointer ? propertiesOfTypeNode(pointer) : null;
  const pointerSrc = pointer ? srcRef(pointer, repoRoot) : undefined;

  const groupTransform = sf.getTypeAlias('GroupTransform');
  const groupTransformSrc = groupTransform ? srcRef(groupTransform, repoRoot) : undefined;

  const out: Record<string, GestureSchema> = {};
  for (const id of GESTURE_IDS) {
    const found = resolveGesture(id, {
      pointerProps,
      pointerSrc,
      groupTransformSrc,
    });
    out[id] = {
      id,
      payload: found.payload,
      ...(found.source ? { source: found.source } : {}),
    };
  }
  return out;
}

function resolveGesture(
  id: string,
  ctx: {
    pointerProps: readonly PropertyDescriptor[] | null;
    pointerSrc: SourceRef | undefined;
    groupTransformSrc: SourceRef | undefined;
  },
): Found {
  switch (id) {
    case 'drag':
      return {
        payload: [{ name: 'transform', type: 'GroupTransform', optional: false }],
        source: ctx.groupTransformSrc,
      };
    case 'wheel':
      return {
        payload: [{ name: 'deltaY', type: 'number', optional: false }],
      };
    case 'key':
    case 'keyDown':
    case 'keyUp':
    case 'key-held':
      return {
        payload: [
          { name: 'code', type: 'string', optional: false },
          { name: 'key', type: 'string', optional: false },
        ],
      };
    case 'pointerDown':
    case 'pointerdown':
      if (ctx.pointerProps) {
        return { payload: ctx.pointerProps, source: ctx.pointerSrc };
      }
      return {
        payload: [
          { name: 'worldX', type: 'number', optional: false },
          { name: 'worldY', type: 'number', optional: false },
          { name: 'clientX', type: 'number', optional: false },
          { name: 'clientY', type: 'number', optional: false },
        ],
      };
    case 'click':
    case 'dblTap':
    case 'doubleClick':
    case 'multiTouch':
    case 'multiTouchTap':
    default:
      return { payload: [] };
  }
}

