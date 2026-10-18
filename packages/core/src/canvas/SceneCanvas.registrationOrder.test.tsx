/**
 * What a consumer registers inside `<SceneCanvas>` lands over the kit's own registrations. Dep
 * sources and actions stack per name, newest live, and both register in effects — so this holds
 * only while the kit's registrations run in a component whose effects come before `children`'s.
 * Called from `SceneCanvasInner` itself, they would run after every child's and win.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { useAction, useActionsRegistry, useDepRegistry, useDepSource, type DepRegistry } from '@weasel-js/routing/react';
import type { Action, ActionsRegistry } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SurfaceContribution } from './surfaceContribution';
import type { InsertDep, SnapDep, TextEditDep } from 'interactions/actions/depSchema';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

const textEdit = { startEdit: () => {}, isTextNode: () => true } as unknown as TextEditDep;
const insert = { build: () => null } as unknown as InsertDep;
const snap = { snapPoint: (p: unknown) => p } as unknown as SnapDep;
const selectAll: Action = { id: 'selectAll', label: 'mine', invoker: { kind: 'immediate', run: () => {} } } as unknown as Action;

let deps: DepRegistry | null = null;
let actions: ActionsRegistry | null = null;

function ConsumerOverrides() {
  useDepSource('textEdit', () => textEdit);
  useDepSource('insert', () => insert);
  useAction(selectAll);
  const d = useDepRegistry();
  const a = useActionsRegistry();
  useEffect(() => { deps = d; actions = a; });
  return null;
}

const contribution: SurfaceContribution = {
  id: 'snapper',
  eligibility: { always: true },
  deps: { snap: () => snap },
};

describe('SceneCanvas registration order', () => {
  it('a child of the canvas overrides the kit\'s own deps and actions', () => {
    const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}>
        <ConsumerOverrides />
      </SceneCanvas>,
    );
    expect(deps!.get('textEdit')).toBe(textEdit);
    expect(deps!.get('insert')).toBe(insert);
    expect(actions!.list().find((x) => x.id === 'selectAll')?.label).toBe('mine');
  });

  it('a contribution\'s deps override the kit\'s', () => {
    const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ambient={[contribution]}>
        <ConsumerOverrides />
      </SceneCanvas>,
    );
    expect(deps!.get('snap')).toBe(snap);
  });
});
