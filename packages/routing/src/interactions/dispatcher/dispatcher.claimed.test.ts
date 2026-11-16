/**
 * A `claimed` entry hears only input that hit one of its own affordances: the
 * hit's `owner` is the entry's id or one its `claimed` list names. Its bindings
 * here target nothing, so the eligibility alone decides.
 */
import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Contribution } from '../../contributions/types';
import type { InputEvent } from './matcher';
import { keyAEvent, makeCtx, makeRegistry } from './testing/dispatcherStubs';
import type { Action } from '../actions/action';

const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

function clickOn(owner: string | null): InputEvent {
  return {
    kind: 'click', x: 1, y: 1, pressX: 1, pressY: 1, ...noMods,
    ...(owner === null ? {} : { affordance: { kind: `layer:${owner}`, owner } }),
  } as InputEvent;
}

function action(id: string): Action & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn();
  return { id, label: id, invoker: { timing: 'immediate', run }, run };
}

function setup() {
  const hud = action('hud.release');
  const plot = action('plot.grab');
  const hudKey = action('hud.key');
  const entries: Contribution[] = [
    {
      id: 'weasel-hud', eligibility: { claimed: true },
      bindings: [{ spec: { kind: 'click' }, actionId: hud.id }, { spec: { kind: 'key', key: 'a' }, actionId: hudKey.id }],
    },
    { id: 'weasel-plot', eligibility: { claimed: ['plot-handles'] }, bindings: [{ spec: { kind: 'click' }, actionId: plot.id }] },
  ];
  const ctx = makeCtx({
    actions: makeRegistry([hud, plot, hudKey]),
    activeToolId: null,
    entriesById: new Map(entries.map((e) => [e.id, e])),
  });
  return { hud, plot, hudKey, ctx, dispatcher: createDispatcher() };
}

describe('a claimed entry', () => {
  it('hears a click on its own affordance and not one on another entry\'s', () => {
    const { hud, plot, ctx, dispatcher } = setup();
    expect(dispatcher.handleInput(clickOn('weasel-hud'), ctx)).toBe('handled');
    expect(hud.run).toHaveBeenCalledOnce();
    expect(plot.run).not.toHaveBeenCalled();
  });

  it('hears a click on a layer its claimed list names', () => {
    const { hud, plot, ctx, dispatcher } = setup();
    expect(dispatcher.handleInput(clickOn('plot-handles'), ctx)).toBe('handled');
    expect(plot.run).toHaveBeenCalledOnce();
    expect(hud.run).not.toHaveBeenCalled();
  });

  it('hears nothing on a kit affordance or on bare canvas', () => {
    const { hud, plot, ctx, dispatcher } = setup();
    expect(dispatcher.handleInput(clickOn('corner-resize'), ctx)).toBe('unhandled');
    expect(dispatcher.handleInput(clickOn(null), ctx)).toBe('unhandled');
    expect(hud.run).not.toHaveBeenCalled();
    expect(plot.run).not.toHaveBeenCalled();
  });

  it('hears no keystroke, which hits no affordance', () => {
    const { hudKey, ctx, dispatcher } = setup();
    expect(dispatcher.handleInput(keyAEvent, ctx)).toBe('unhandled');
    expect(hudKey.run).not.toHaveBeenCalled();
  });
});
