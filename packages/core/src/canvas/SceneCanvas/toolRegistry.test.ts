import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveFeatures, type FeaturePreset } from './features';
import { viewPreset } from './presets';
import { BUILTIN_TOOL_IDS } from './props';
import { resolveToolRegistry, type BuiltinTools } from './toolRegistry';
import type { Tool } from 'tools/overlayBinding';
import { toolSet, withoutTools } from '@weasel-js/routing';

const tool = (id: string): Tool => ({ id, eligibility: { focus: true } }) as Tool;
const builtins = Object.fromEntries(BUILTIN_TOOL_IDS.map((id) => [id, tool(id)])) as BuiltinTools;
/** What a package's `build` offers by id, in its order. */
const OFFERED_IDS = ['lasso', 'rect', 'ellipse', 'star'];
const offered = Object.fromEntries(OFFERED_IDS.map((id) => [id, tool(id)]));
const SHAPES = toolSet('shape', ['rect', 'ellipse', 'star']);
const selectPreset: FeaturePreset = { id: 'select', tools: ['select', 'lasso'] };
const NONE = resolveFeatures([]);
const args = { builtins, offered, enabled: NONE, patch: null };

afterEach(() => { vi.restoreAllMocks(); });

describe('resolveToolRegistry', () => {
  it('mounts a patch tool whose id names an Object.prototype member as its own entry', () => {
    const registry = resolveToolRegistry({ ...args, patch: Object.fromEntries([['__proto__', tool('__proto__')], ['toString', tool('toString')]]) });
    expect(Object.getPrototypeOf(registry)).toBe(Object.prototype);
    expect(Object.keys(registry)).toEqual(['__proto__', 'toString']);
  });

  it('mounts an offered tool `defaultTools` names, after core\'s own, in the order it is offered', () => {
    const registry = resolveToolRegistry({ ...args, defaultTools: ['star', 'rect', 'hand'] });
    expect(Object.keys(registry)).toEqual(['hand', 'rect', 'star']);
    expect(registry.rect).toBe(offered.rect);
  });

  it('mounts an offered tool the patch asks for by `true` without it being in defaultTools', () => {
    const registry = resolveToolRegistry({ ...args, patch: { rect: true, ellipse: true } });
    expect(Object.keys(registry)).toEqual(['rect', 'ellipse']);
  });

  it('mounts nothing offered that nothing names', () => {
    expect(resolveToolRegistry(args)).toEqual({});
  });

  it('mounts the tools a set names, and a set less some of them', () => {
    const shapes = resolveToolRegistry({ ...args, defaultTools: [SHAPES, 'hand'] });
    expect(Object.keys(shapes)).toEqual(['hand', 'rect', 'ellipse', 'star']);
    const cut = resolveToolRegistry({ ...args, defaultTools: [withoutTools(SHAPES, 'ellipse')] });
    expect(Object.keys(cut)).toEqual(['rect', 'star']);
  });

  it('mounts the tools a preset names by set', () => {
    const enabled = resolveFeatures([{ id: 'mine', tools: [SHAPES] }]);
    expect(Object.keys(resolveToolRegistry({ ...args, enabled }))).toEqual(['rect', 'ellipse', 'star']);
  });

  it('mounts no id nothing offers, though a preset names it', () => {
    const enabled = resolveFeatures([{ id: 'mine', tools: [SHAPES] }]);
    expect(Object.keys(resolveToolRegistry({ builtins, enabled, patch: null }))).toEqual([]);
  });

  it('lets an offered tool stand in for one of core\'s own', () => {
    const select = tool('select');
    const registry = resolveToolRegistry({ ...args, offered: { ...offered, select }, enabled: resolveFeatures([selectPreset]) });
    expect(Object.keys(registry)).toEqual(['select', 'lasso']);
    expect(registry.select).toBe(select);
  });

  it('brings the tools a preset names and the hand with view', () => {
    expect(Object.keys(resolveToolRegistry({ ...args, enabled: resolveFeatures([selectPreset]) }))).toEqual(['select', 'lasso']);
    expect(Object.keys(resolveToolRegistry({ ...args, enabled: resolveFeatures([viewPreset]) }))).toEqual(['hand']);
  });

  it("mounts a preset's own tool after the offered ones, and a patch's false drops it", () => {
    const own = tool('own');
    const enabled = resolveFeatures([selectPreset, { id: 'mine', tools: ['hand', own] }]);
    expect(Object.keys(resolveToolRegistry({ ...args, enabled }))).toEqual(['select', 'hand', 'lasso', 'own']);
    expect(Object.keys(resolveToolRegistry({ ...args, enabled, patch: { own: false } }))).toEqual(['select', 'hand', 'lasso']);
  });

  it('drops a requested tool the patch sets to false', () => {
    const registry = resolveToolRegistry({ ...args, defaultTools: OFFERED_IDS, patch: { star: false, notMounted: false } });
    expect(Object.keys(registry)).toEqual(OFFERED_IDS.filter((id) => id !== 'star'));
  });

  it('replaces a mounted tool where it stands, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mine = tool('star');
    const registry = resolveToolRegistry({ ...args, defaultTools: OFFERED_IDS, patch: { star: mine }, dev: true });
    expect(Object.keys(registry)).toEqual(OFFERED_IDS);
    expect(registry.star).toBe(mine);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('overrides bundled "star"'));
  });

  it('replaces a tool a preset implies where it stands, silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hand = tool('hand');
    const own = tool('own');
    const mine = tool('own');
    const enabled = resolveFeatures([selectPreset, viewPreset, { id: 'mine', tools: [own] }]);
    const registry = resolveToolRegistry({ ...args, defaultTools: ['rect'], enabled, patch: { hand, own: mine }, dev: true });
    expect(Object.keys(registry)).toEqual(['select', 'hand', 'lasso', 'rect', 'own']);
    expect(registry.hand).toBe(hand);
    expect(registry.own).toBe(mine);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still says so when a preset implies a tool defaultTools also asks for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveToolRegistry({ ...args, defaultTools: ['hand'], enabled: resolveFeatures([viewPreset]), patch: { hand: tool('hand') }, dev: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('overrides bundled "hand"'));
  });

  it('appends a tool under an unmounted id after the rest, in patch order, silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = tool('a');
    const pen = tool('pen');
    const registry = resolveToolRegistry({ ...args, defaultTools: ['rect'], enabled: resolveFeatures([selectPreset]), patch: { a, pen }, dev: true });
    expect(Object.keys(registry)).toEqual(['select', 'lasso', 'rect', 'a', 'pen']);
    expect(registry.pen).toBe(pen);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores `true` on an id nothing offers, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = resolveToolRegistry({ ...args, patch: { nope: true, toString: true }, dev: true });
    expect(registry).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tools.nope=true'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tools.toString=true'));
  });

  it('stays quiet outside dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveToolRegistry({ ...args, defaultTools: OFFERED_IDS, patch: { nope: true, star: tool('star') }, dev: false });
    expect(warn).not.toHaveBeenCalled();
  });
});
