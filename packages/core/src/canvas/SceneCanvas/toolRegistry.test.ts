import { describe, it, expect, vi, afterEach } from 'vitest';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import { resolveFeatures, type BaseFeature } from './features';
import { CORE_NAMED_PRESETS } from './namedPresets';
import { BUILTIN_TOOL_IDS, type BuiltinToolId } from './props';
import { resolveToolRegistry, type BuiltinTools } from './toolRegistry';
import type { Tool } from 'tools/overlayBinding';
import { toolIdsOf, withoutTools } from '@weasel-js/routing';
import { BUILTIN_TOOLS, PAGE_TOOLS, SHAPE_TOOLS, TYPE_TOOLS } from './builtinToolSets';

// A kind the resolver has never heard of, so the tests below can only pass by
// reading the table.
vi.mock('core/shapeKinds', async (importOriginal) => {
  const real = await importOriginal<typeof import('core/shapeKinds')>();
  const SHAPE_KINDS = { ...real.SHAPE_KINDS, blob: { tool: true, insertPreview: false } };
  return { ...real, SHAPE_KINDS, KIT_SHAPE_KINDS: real.shapeKindsWhere(SHAPE_KINDS, 'tool') };
});

const tool = (id: string): Tool => ({ id, eligibility: { focus: true } }) as Tool;
const builtins = Object.fromEntries(BUILTIN_TOOL_IDS.map((id) => [id, tool(id)])) as BuiltinTools;
const presets = (...on: BaseFeature[]) => resolveFeatures(on, CORE_NAMED_PRESETS);
const NONE = presets();

afterEach(() => { vi.restoreAllMocks(); });

describe('resolveToolRegistry', () => {
  const inPaletteOrder = BUILTIN_TOOL_IDS.filter((id) => (KIT_SHAPE_KINDS as readonly string[]).includes(id));

  it('mounts every shape kind the table lists, in palette order', () => {
    expect(KIT_SHAPE_KINDS).toContain('blob');
    expect(inPaletteOrder).toHaveLength(KIT_SHAPE_KINDS.length);
    const registry = resolveToolRegistry({ builtins, defaultTools: KIT_SHAPE_KINDS, enabled: NONE, patch: null });
    expect(Object.keys(registry)).toEqual(inPaletteOrder);
    for (const id of KIT_SHAPE_KINDS) expect(registry[id]).toBe(builtins[id]);
  });

  it('mounts a kind the patch asks for by `true` without it being in defaultTools', () => {
    const registry = resolveToolRegistry({
      builtins, enabled: NONE, patch: Object.fromEntries(KIT_SHAPE_KINDS.map((id) => [id, true as const])),
    });
    expect(Object.keys(registry)).toEqual(inPaletteOrder);
  });

  it('mounts the tools a set names, and a set less some of them', () => {
    const shapes = resolveToolRegistry({ builtins, defaultTools: [SHAPE_TOOLS, 'hand'], enabled: NONE, patch: null });
    expect(Object.keys(shapes)).toEqual(['hand', 'rect', 'ellipse', 'line', 'polygon', 'star']);
    const cut = resolveToolRegistry({ builtins, defaultTools: [withoutTools(BUILTIN_TOOLS, PAGE_TOOLS, TYPE_TOOLS)], enabled: NONE, patch: null });
    expect(Object.keys(cut)).not.toContain('slice');
    expect(Object.keys(cut)).not.toContain('sticky');
    expect(Object.keys(cut)).toContain('pen');
  });

  it('derives the built-in ids from the built-in set', () => {
    expect(toolIdsOf([BUILTIN_TOOLS])).toEqual([...BUILTIN_TOOL_IDS]);
  });

  it("mounts the tools a preset names by set", () => {
    const enabled = resolveFeatures([{ id: 'mine', tools: [TYPE_TOOLS] }], CORE_NAMED_PRESETS);
    expect(Object.keys(resolveToolRegistry({ builtins, enabled, patch: null }))).toEqual(['text', 'sticky']);
  });

  it('mounts nothing when nothing is asked for', () => {
    expect(resolveToolRegistry({ builtins, enabled: NONE, patch: null })).toEqual({});
  });

  it('brings the select tool with the select preset and the hand with view', () => {
    expect(Object.keys(resolveToolRegistry({ builtins, enabled: presets('select'), patch: null }))).toEqual(['select']);
    expect(Object.keys(resolveToolRegistry({ builtins, enabled: presets('view'), patch: null }))).toEqual(['hand']);
  });

  it("mounts a preset's own tool after the built-ins, and a patch's false drops it", () => {
    const own = tool('own');
    const enabled = resolveFeatures(['select', { id: 'mine', tools: ['hand', own] }], CORE_NAMED_PRESETS);
    expect(Object.keys(resolveToolRegistry({ builtins, enabled, patch: null }))).toEqual(['select', 'hand', 'own']);
    expect(Object.keys(resolveToolRegistry({ builtins, enabled, patch: { own: false } }))).toEqual(['select', 'hand']);
  });

  it('orders built-ins in palette order, whatever order they were asked in', () => {
    const asked = [...BUILTIN_TOOL_IDS].reverse();
    const registry = resolveToolRegistry({ builtins, defaultTools: asked, enabled: NONE, patch: null });
    expect(Object.keys(registry)).toEqual([...BUILTIN_TOOL_IDS]);
  });

  it('drops a requested built-in the patch sets to false', () => {
    const registry = resolveToolRegistry({
      builtins, defaultTools: BUILTIN_TOOL_IDS, enabled: NONE, patch: { pen: false, notMounted: false },
    });
    expect(Object.keys(registry)).toEqual(BUILTIN_TOOL_IDS.filter((id) => id !== 'pen'));
  });

  it('replaces a mounted built-in where it stands, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mine = tool('pen');
    const registry = resolveToolRegistry({
      builtins, defaultTools: BUILTIN_TOOL_IDS, enabled: NONE, patch: { pen: mine }, dev: true,
    });
    expect(Object.keys(registry)).toEqual([...BUILTIN_TOOL_IDS]);
    expect(registry.pen).toBe(mine);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('overrides bundled "pen"'));
  });

  it('replaces a tool a preset implies where it stands, silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hand = tool('hand');
    const own = tool('own');
    const mine = tool('own');
    const enabled = resolveFeatures(['select', 'view', { id: 'mine', tools: [own] }], CORE_NAMED_PRESETS);
    const registry = resolveToolRegistry({
      builtins, defaultTools: ['rect' as BuiltinToolId], enabled, patch: { hand, own: mine }, dev: true,
    });
    expect(Object.keys(registry)).toEqual(['select', 'hand', 'rect', 'own']);
    expect(registry.hand).toBe(hand);
    expect(registry.own).toBe(mine);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still says so when a preset implies a tool defaultTools also asks for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveToolRegistry({
      builtins, defaultTools: ['hand' as BuiltinToolId], enabled: presets('view'), patch: { hand: tool('hand') }, dev: true,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('overrides bundled "hand"'));
  });

  it('appends a tool under an unmounted id after the built-ins, in patch order, silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = tool('a');
    const pen = tool('pen');
    const registry = resolveToolRegistry({
      builtins, defaultTools: ['rect' as BuiltinToolId], enabled: presets('select'), patch: { a, pen }, dev: true,
    });
    expect(Object.keys(registry)).toEqual(['select', 'rect', 'a', 'pen']);
    expect(registry.pen).toBe(pen);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores `true` on an id that is not a built-in, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = resolveToolRegistry({
      builtins, enabled: NONE, patch: { nope: true, toString: true }, dev: true,
    });
    expect(registry).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tools.nope=true'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tools.toString=true'));
  });

  it('stays quiet outside dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveToolRegistry({
      builtins, defaultTools: BUILTIN_TOOL_IDS, enabled: NONE, patch: { nope: true, pen: tool('pen') }, dev: false,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
