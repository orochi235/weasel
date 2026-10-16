import { describe, expect, it, vi } from 'vitest';
import { resolveMenu, type MenuSources } from './resolveMenu';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';

const immediate = { timing: 'immediate' as const, run: () => {} };
const actions: Action[] = [
  { id: 'cut', label: 'Cut', invoker: immediate, defaultBinding: { kind: 'key', key: 'x', mods: { meta: true } } },
  { id: 'paste', label: 'Paste', invoker: immediate,
    enabled: (_d, at) => (at ? true : ActionDisabledReason.NotApplicable) },
  { id: 'snap', label: 'Snap', invoker: immediate, active: () => true },
  { id: 'align', label: 'Align', invoker: immediate, variants: [
    { key: 'l', label: 'Left', params: { edge: 'left' } },
    { key: 'r', label: 'Right', params: { edge: 'right' } },
  ] },
  { id: 'flip', label: 'Flip', icon: 'flip-icon', invoker: immediate, variants: [
    { key: 'h', label: 'Horizontal', icon: 'h-icon', params: { axis: 'x' } },
    { key: 'v', label: 'Vertical', params: { axis: 'y' } },
  ] },
  { id: 'drag', label: 'Drag', invoker: { timing: 'ongoing', start: () => ({}) as never } },
];

function sources(): MenuSources & { trigger: ReturnType<typeof vi.fn> } {
  return { actions: () => actions, depsFor: () => undefined, trigger: vi.fn(() => true) };
}

describe('resolveMenu', () => {
  it('builds rows from the registry and separators between sections', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ action: 'cut' }], [{ action: 'snap' }]] }, sources());
    expect(entries.map((e) => e.kind)).toEqual(['item', 'separator', 'item']);
    expect(entries[0]).toMatchObject({ label: 'Cut', shortcut: expect.objectContaining({ key: 'x' }) });
    expect(entries[2]).toMatchObject({ checked: true });
  });
  it('drops unregistered and non-immediate actions, and sections left empty', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ action: 'nope' }, { action: 'drag' }], [{ action: 'cut' }]] }, sources());
    expect(entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Cut']);
  });
  it('asks enabled with the point', () => {
    const def = { id: 'm', sections: [[{ action: 'paste' }]] };
    expect(resolveMenu(def, sources(), { x: 1, y: 2 })[0]).toMatchObject({ disabled: false });
    expect(resolveMenu(def, sources())[0]).toMatchObject({ disabled: true });
  });
  it('runs through trigger with the item params, the menu params and the point', () => {
    const src = sources();
    const [row] = resolveMenu({ id: 'm', sections: [[{ action: 'cut', params: { a: 1 } }]] }, src, { x: 3, y: 4 }, { nodeId: 'n1' });
    (row as { run(): void }).run();
    expect(src.trigger).toHaveBeenCalledWith('cut', { nodeId: 'n1', a: 1, worldX: 3, worldY: 4 });
  });
  it('expands actionVariants into one row each', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ actionVariants: 'align' }]] }, sources());
    expect(entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Left', 'Right']);
  });
  it('nests submenus and drops an empty one', () => {
    const def = { id: 'm', sections: [[
      { submenu: 'arr', label: 'Arrange', sections: [[{ action: 'cut' }]] },
      { submenu: 'none', label: 'Nothing', sections: [[{ action: 'nope' }]] },
    ]] };
    const entries = resolveMenu(def, sources());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'submenu', label: 'Arrange' });
  });

  it('shows a variant its own icon and falls back to the action icon', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ actionVariants: 'flip' }]] }, sources());
    expect(entries.map((e) => e.kind === 'item' && e.icon)).toEqual(['h-icon', 'flip-icon']);
  });
  it('lets item params beat menu params, and the point beat item params', () => {
    const src = sources();
    const def = { id: 'm', sections: [[{ action: 'cut', params: { a: 1, worldX: 99 } }]] };
    (resolveMenu(def, src, { x: 3, y: 4 }, { a: 0 })[0] as { run(): void }).run();
    expect(src.trigger).toHaveBeenCalledWith('cut', { a: 1, worldX: 3, worldY: 4 });
  });
  it('sends no point when opened without one', () => {
    const src = sources();
    (resolveMenu({ id: 'm', sections: [[{ action: 'cut' }]] }, src)[0] as { run(): void }).run();
    expect(src.trigger).toHaveBeenCalledWith('cut', {});
  });
  it('runs a variant row with that variant params', () => {
    const src = sources();
    const rows = resolveMenu({ id: 'm', sections: [[{ actionVariants: 'align' }]] }, src);
    (rows[1] as { run(): void }).run();
    expect(src.trigger).toHaveBeenCalledWith('align', { edge: 'right' });
  });
  it('gives the same action listed twice distinct keys', () => {
    const def = { id: 'm', sections: [[
      { action: 'align', params: { edge: 'left' } }, { action: 'align', params: { edge: 'right' } },
    ], [{ action: 'align' }]] };
    const keys = resolveMenu(def, sources()).map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('keeps variant keys distinct when the action repeats', () => {
    const def = { id: 'm', sections: [[{ actionVariants: 'align' }, { actionVariants: 'align' }]] };
    const keys = resolveMenu(def, sources()).map((e) => e.key);
    expect(new Set(keys).size).toBe(4);
  });
});
