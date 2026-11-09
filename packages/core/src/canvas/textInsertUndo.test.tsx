/**
 * A text box or sticky note inserted and typed into is one undo entry: the
 * insert and the edit's first commit undo together.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { ActionDeps } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { enterInsertedText } from 'interactions/actions/insert/commit';
import { placeAction } from 'interactions/actions/insert/placeAction';
import { SceneCanvas } from './SceneCanvas';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

type D = { text?: string };
type P = { x: number; y: number; width: number; height: number };

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  let registry!: DepRegistry;
  function Capture(): null {
    registry = useDepRegistry();
    return null;
  }
  const frame = render(
    <div data-testid="frame">
      <SceneCanvas scene={scene} width={300} height={200} features={['edit']}>
        <Capture />
      </SceneCanvas>
    </div>,
  ).getByTestId('frame');
  const deps = () => ({ insert: registry.get('insert')!, textEdit: registry.get('textEdit')!, scene });
  /** A drag's insert as `commitInsert` makes it: the dep commits, then the caret opens. */
  const drag = (kind: string): string => {
    const { insert, textEdit } = deps();
    let id: string | null = null;
    act(() => {
      const made = insert.commit({ x: 10, y: 10, width: 120, height: 60 }, { kind }, undefined, undefined);
      id = made === null ? null : String(made);
      enterInsertedText(textEdit, id, kind);
    });
    return id!;
  };
  /** A sticky placed by a click, through the place action. */
  const click = (): string => {
    const before = new Set([...scene.renderOrder()].map(String));
    if (placeAction.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
    const run = placeAction.invoker.run;
    act(() => {
      run(deps() as unknown as ActionDeps, { world: { x: 100, y: 80 }, press: { x: 100, y: 80 }, kind: 'sticky', size: { width: 80, height: 80 } });
    });
    return [...scene.renderOrder()].map(String).find((id) => !before.has(id))!;
  };
  const overlay = () => frame.querySelector<HTMLElement>('[contenteditable="true"]');
  const type = (text: string) => {
    const el = overlay()!;
    el.textContent = text;
    act(() => { el.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  const blur = () => act(() => { overlay()!.dispatchEvent(new FocusEvent('blur')); });
  const text = (id: string) => scene.get(asNodeId(id))?.data.text;
  return { scene, drag, click, overlay, type, blur, text, deps };
}

const inserts: Array<[string, (t: ReturnType<typeof mount>) => string]> = [
  ['a text box drawn with the text tool', (t) => t.drag('text')],
  ['a sticky note drawn by a drag', (t) => t.drag('sticky')],
  ['a sticky note placed by a click', (t) => t.click()],
];

describe.each(inserts)('%s and typed into', (_name, insert) => {
  it('is one undo entry, which takes the node away', () => {
    const t = mount();
    const entries = t.scene.historyEntries().length;
    const id = insert(t);
    expect(t.overlay()).not.toBeNull();
    t.type('hello');
    t.blur();
    expect(t.text(id)).toBe('hello');
    expect(t.scene.historyEntries()).toHaveLength(entries + 1);
    act(() => { t.scene.undo(); });
    expect(t.scene.get(asNodeId(id))).toBeUndefined();
    act(() => { t.scene.redo(); });
    expect(t.text(id)).toBe('hello');
  });

  it('keeps a later edit of the node its own entry', () => {
    const t = mount();
    const id = insert(t);
    t.type('hello');
    t.blur();
    const entries = t.scene.historyEntries().length;
    act(() => { t.deps().textEdit.startEdit(id); });
    t.type('bye');
    t.blur();
    expect(t.scene.historyEntries()).toHaveLength(entries + 1);
    act(() => { t.scene.undo(); });
    expect(t.text(id)).toBe('hello');
  });
});

describe('a text node inserted with its text, as a paste makes one', () => {
  it('keeps an edit made right after it its own entry', () => {
    const t = mount();
    let id = '';
    act(() => { id = String(t.deps().insert.commit({ x: 10, y: 10, width: 120, height: 60 }, { kind: 'text', text: 'pasted' })); });
    const entries = t.scene.historyEntries().length;
    act(() => { t.deps().textEdit.startEdit(id); });
    t.type('edited');
    t.blur();
    expect(t.scene.historyEntries()).toHaveLength(entries + 1);
    act(() => { t.scene.undo(); });
    expect(t.text(id)).toBe('pasted');
  });
});
