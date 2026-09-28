import { describe, it, expect } from 'vitest';
import { parseRoute } from './routeGrammar';
import { routeToSpec } from './routeToSpec';
import { matchSpec, type PhaseContext } from '../ui/match';
import { specificity } from '../ui/specificity';

const spec = (route: string) => routeToSpec(parseRoute(route));
const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

describe('routeToSpec', () => {
  it('maps each pointer gesture to its spec kind', () => {
    expect(spec('[*] click').kind).toBe('click');
    expect(spec('[*] pointerDown').kind).toBe('pointerDown');
    expect(spec('[*] dblTap').kind).toBe('doubleClick');
    expect(spec('[*] drag').kind).toBe('drag');
    expect(spec('[*] contextMenu').kind).toBe('contextMenu');
    expect(spec('[*] longPress').kind).toBe('longPress');
  });

  it('omits a wildcard target and phase, and keeps no empty mods', () => {
    expect(spec('[*] drag')).toEqual({ kind: 'drag' });
  });

  it('carries a target form through', () => {
    expect(spec('[*] click => empty')).toEqual({ kind: 'click', target: 'empty' });
    expect(spec('[*] drag => kind:rect:selected')).toEqual({ kind: 'drag', target: 'kind:rect:selected' });
  });

  it('rejects a target no TargetSpec form can hold', () => {
    expect(() => spec('[*] click => node')).toThrow(/target/);
  });

  it('turns required and optional modifiers into a ModSpec', () => {
    expect(spec('[*] drag +mod +alt ?shift')).toEqual({
      kind: 'drag', mods: { mod: true, alt: true, shift: 'optional' },
    });
  });

  it('keeps concrete phase atoms', () => {
    expect(spec('[initial,rect:engaged] drag').phase).toEqual([
      { channel: '&', phase: 'initial' },
      { channel: 'rect', phase: 'engaged' },
    ]);
  });

  it('maps wheel and pinch directions, dropping the wildcard', () => {
    expect(spec('[*] wheel(up)')).toEqual({ kind: 'wheel', direction: 'up' });
    expect(spec('[*] wheel')).toEqual({ kind: 'wheel' });
    expect(spec('[*] pinch(out)')).toEqual({ kind: 'pinch', direction: 'out' });
  });

  it('reads a key arg through the key-route grammar', () => {
    expect(spec('[*] keyDown(z?shift) +mod')).toEqual({
      kind: 'key', key: 'z', mods: { mod: true, shift: 'optional' },
    });
    expect(spec('[*] keyHeld(Space)')).toEqual({ kind: 'key-held', key: 'Space' });
  });

  it('maps fingers and MIME lists', () => {
    expect(spec('[*] multiTouchTap(3)')).toEqual({ kind: 'multiTouchTap', fingers: 3 });
    expect(spec('[*] drop(image/*|text/plain)')).toEqual({ kind: 'drop', types: ['image/*', 'text/plain'] });
    expect(spec('[*] paste')).toEqual({ kind: 'paste' });
  });

  it('rejects routes no GestureSpec can express', () => {
    expect(() => spec('[*] keyUp(a)')).toThrow(/keyUp/);
    expect(() => spec('[*] keyDown')).toThrow(/key/);
    expect(() => spec('[*] multiTouchTap')).toThrow(/fingers/);
  });

  it('drives matchSpec', () => {
    const ctx: PhaseContext = { selfChannel: 'pad', engagedChannels: new Set() };
    const s = spec('[initial] click => empty +shift');
    expect(matchSpec({ kind: 'click', ...noMods, shiftKey: true, bodyTarget: 'empty' }, s, false, ctx)).toBe(true);
    expect(matchSpec({ kind: 'click', ...noMods, bodyTarget: 'empty' }, s, false, ctx)).toBe(false);
  });

  it('ranks the same as the equivalent hand-written spec', () => {
    expect(specificity(spec('[engaged] drag => kind:rect +mod'))).toEqual(
      specificity({ kind: 'drag', target: 'kind:rect', mods: { mod: true }, phase: 'engaged' }),
    );
  });
});
