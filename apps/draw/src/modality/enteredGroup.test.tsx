/**
 * The entered group in draw: a double-click on a member enters it, everything outside dims and
 * takes no hits, the workspace is tinted, and the breadcrumb names it. Mounted the way Workspace
 * wires the canvas, since App's canvas never mounts in jsdom.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useState, type ReactElement } from 'react';
import {
  SceneCanvas, asNodeId, createScene, pathFromD, solid, useSelection, workspaceTintLayer,
  type PolygonPath, type SelectionApi,
} from '@weasel-js/core';
import { TextEditDepPublisher } from '@weasel-js/editor';
import type { DrawScene } from '../drawDocument';
import { useTextEditSession } from '../useTextEditSession';
import { ModeBreadcrumb } from './chrome/ModeBreadcrumb';
import { canvasAlphaFor, useDrawEnteredGroup, useEnteredGroupLabel, type DrawEnteredGroup } from './enteredGroup';
import { useCanvasModes } from './useCanvasModes';
import { useModality, type UseModalityReturn } from './useModality';
import { useModeId } from './useModeId';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = () => null;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

const square = (x: number, width = 30) => ({ x, y: 0, width, height: 30 });
const outline = () => pathFromD('M 0 0 L 30 0 L 30 30 L 0 30 Z') as PolygonPath;
/** Left edge of each node; a press lands 15px in. `g` spans `a`, `inner` (holding `deep`) and
 *  `txt`; `f` stands outside it. */
const AT = { a: 0, deep: 40, txt: 80, f: 150 } as const;

interface Live {
  scene: DrawScene;
  modality: UseModalityReturn;
  group: DrawEnteredGroup;
  selection: SelectionApi;
  textEdit: ReturnType<typeof useTextEditSession>;
  alphaFor: (id: string) => number;
}

function Harness({ into }: { into: (live: Live) => void }): ReactElement {
  const [scene] = useState(() => {
    const s = createScene({ systemLayers: [{ id: 'main' }] });
    const add = (id: string, kind: 'mark' | 'group', x: number, data: unknown, parent?: string, width?: number) => s.add({
      id: asNodeId(id), kind, layer: 'main', data, pose: square(x, width),
      ...(parent ? { parent: asNodeId(parent) } : {}),
    } as never);
    add('g', 'group', 0, { label: 'Logo' }, undefined, 110);
    add('a', 'mark', AT.a, { path: outline(), fill: { paint: solid('#888') } }, 'g');
    add('inner', 'group', AT.deep, {}, 'g');
    add('deep', 'mark', AT.deep, { path: outline(), fill: { paint: solid('#888') } }, 'inner');
    add('txt', 'mark', AT.txt, { text: 'hello' }, 'g');
    add('f', 'mark', AT.f, { path: outline(), fill: { paint: solid('#888') } });
    return s as unknown as DrawScene;
  });
  const [host] = useState(() => document.body.appendChild(document.createElement('div')));
  const selection = useSelection({ mode: 'multi', scene });
  const modality = useModality(scene as never);
  const { machine } = modality;
  const modeId = useModeId(machine);
  const modes = useCanvasModes(machine, scene, selection, modality.pathEdit);
  const group = useDrawEnteredGroup(scene);
  const groupLabel = useEnteredGroupLabel(group, scene);
  const textEdit = useTextEditSession(scene, host, machine);
  const alphaFor = canvasAlphaFor(modality.scopingDim.alphaFor, group.scope, textEdit.editingId);
  into({ scene, modality, group, selection, textEdit, alphaFor });
  return (
    <>
      <ModeBreadcrumb
        mode={machine.registry.byId(modeId)} targetLabel={null}
        group={groupLabel === null ? null : { label: groupLabel, onExit: group.entered.leaveAll }}
        onExit={() => machine.exitMode()} onCommit={() => machine.commitMode()} onCancel={() => machine.cancelMode()} />
      <SceneCanvas features={['draw']} scene={scene} selection={selection} layers={{}} width={200} height={40}
        ambient={modes.ambient} modes={machine.registry} pathEdit={modes.pathEdit}
        alphaFor={alphaFor} redrawOn={[modality.scopingDim, group.scope]}
        isPointerInteractive={modality.scopingDim.isPointerInteractive}
        enteredGroup={group.entered}>
        <TextEditDepPublisher edit={textEdit} />
      </SceneCanvas>
    </>
  );
}

function setup() {
  let live!: Live;
  render(<Harness into={(l) => { live = l; }} />);
  const canvas = () => document.querySelector('canvas')!;
  const fire = (type: string, x: number) =>
    canvas().dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x + 15, clientY: 15, pointerId: 1, button: 0, buttons: 1 }));
  const press = (x: number) => act(() => { fire('pointerdown', x); fire('pointerup', x); });
  const doubleClick = (x: number) => { press(x); press(x); };
  const escape = (target: EventTarget = window) => act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  return {
    live: () => live,
    press, doubleClick, escape,
    entered: () => live.group.entered.get(),
    mode: () => live.modality.machine.registry.current().id,
    selection: () => [...live.selection.current],
  };
}

describe('the entered group in draw', () => {
  it('a double-click on a member enters its group: the rest dims, the workspace is tinted, the breadcrumb names it', () => {
    const t = setup();
    t.doubleClick(AT.a);
    expect(t.entered()).toBe('g');
    expect(t.mode()).toBe('normal');
    const { alphaFor, group, modality } = t.live();
    expect(alphaFor('f')).toBe(0.3);
    expect(alphaFor('a')).toBe(1);
    const tint = workspaceTintLayer({ registry: modality.machine.registry, fallback: group.tint });
    expect(tint.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 40, dpr: 1 })).not.toEqual([]);
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Logo')).toBeTruthy();
  });

  it('the breadcrumb follows a rename of the entered group', () => {
    const t = setup();
    t.doubleClick(AT.a);
    act(() => { t.live().scene.update(asNodeId('g'), { data: { label: 'Badge' } as never }); });
    expect(screen.getByText('Badge')).toBeTruthy();
  });

  it('a press inside the entered group selects the member pressed', () => {
    const t = setup();
    t.doubleClick(AT.a);
    t.press(AT.a);
    expect(t.selection()).toEqual(['a']);
  });

  it('a node outside the entered group cannot be pressed', () => {
    const t = setup();
    t.doubleClick(AT.a);
    t.press(AT.f);
    expect(t.selection()).not.toContain('f');
  });

  it('Escape leaves one level, and the breadcrumb\'s Exit leaves every level', () => {
    const t = setup();
    t.doubleClick(AT.deep);
    t.doubleClick(AT.deep);
    expect(t.entered()).toBe('inner');
    t.escape();
    expect(t.entered()).toBe('g');
    t.doubleClick(AT.deep);
    expect(t.entered()).toBe('inner');
    act(() => { fireEvent.click(screen.getByRole('button', { name: /exit/i })); });
    expect(t.entered()).toBeNull();
    expect(screen.queryByText('Group')).toBeNull();
  });

  it('a double-click on a path inside the group opens path edit there, and Escape closes it before leaving the group', () => {
    const t = setup();
    t.doubleClick(AT.a);
    t.doubleClick(AT.a);
    expect(t.mode()).toBe('path-edit');
    expect(t.entered()).toBe('g');
    t.escape();
    expect(t.mode()).toBe('normal');
    expect(t.entered()).toBe('g');
    t.escape();
    expect(t.entered()).toBeNull();
  });

  it('Escape while editing text inside the group ends the edit and keeps the group', () => {
    const t = setup();
    t.doubleClick(AT.a);
    act(() => { t.live().textEdit.startEdit('txt'); });
    expect(t.mode()).toBe('text-edit');
    t.escape(document.activeElement ?? window);
    expect(t.live().textEdit.editingId).toBeNull();
    expect(t.mode()).toBe('normal');
    expect(t.entered()).toBe('g');
  });
});
