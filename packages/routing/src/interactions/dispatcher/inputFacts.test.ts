import { expect, it } from 'vitest';
import { immediateParams, immediateRunParams } from './inputFacts';

it('gives a contextmenu its client point and body kind', () => {
  const p = immediateParams({
    kind: 'contextmenu', x: 1, y: 2, clientX: 30, clientY: 40,
    bodyTarget: 'selected-body', bodyKind: 'text',
    shiftKey: false, altKey: false, metaKey: false, ctrlKey: false,
  } as never, undefined);
  expect(p).toMatchObject({ world: { x: 1, y: 2 }, clientX: 30, clientY: 40, bodyTarget: 'selected-body', bodyKind: 'text' });
});

it.each(['click', 'doubleclick', 'pointerdown', 'longpress', 'hover'] as const)('gives a %s its client point and what it landed on', (kind) => {
  const p = immediateParams({
    kind, x: 1, y: 2, clientX: 30, clientY: 40,
    bodyTarget: 'selected-body', bodyKind: 'text',
    shiftKey: false, altKey: false, metaKey: false, ctrlKey: false,
  } as never, undefined);
  expect(p).toMatchObject({ world: { x: 1, y: 2 }, clientX: 30, clientY: 40, bodyTarget: 'selected-body', bodyKind: 'text' });
});

it.each(['wheel', 'pinch'] as const)('gives a %s the body it landed on', (kind) => {
  const p = immediateParams({
    kind, x: 1, y: 2, clientX: 30, clientY: 40, deltaX: 0, deltaY: 1, scale: 1, rotation: 0,
    bodyTarget: 'selected-body', bodyKind: 'text',
    shiftKey: false, altKey: false, metaKey: false, ctrlKey: false,
  } as never, undefined);
  expect(p).toMatchObject({ bodyTarget: 'selected-body', bodyKind: 'text' });
});

it("keeps the binding's own viewId and roles over the dispatcher's", () => {
  const action = { id: 'a', label: 'a', modifierRoles: { fine: { label: 'fine', keys: ['shift'] } }, invoker: { timing: 'immediate', run: () => {} } };
  const p = immediateRunParams({
    kind: 'click', x: 1, y: 2, clientX: 30, clientY: 40,
    shiftKey: true, altKey: false, metaKey: false, ctrlKey: false,
  } as never, { viewId: 'minimap', roles: { fine: false } }, { action: action as never, binding: { spec: { kind: 'click' }, actionId: 'a' } as never, viewId: 'main', apple: false });
  expect(p).toMatchObject({ viewId: 'minimap', roles: { fine: false } });
});

it('gives the routed view and the held roles beneath a binding that names neither', () => {
  const action = { id: 'a', label: 'a', modifierRoles: { fine: { label: 'fine', keys: ['shift'] } }, invoker: { timing: 'immediate', run: () => {} } };
  const p = immediateRunParams({
    kind: 'click', x: 1, y: 2, clientX: 30, clientY: 40,
    shiftKey: true, altKey: false, metaKey: false, ctrlKey: false,
  } as never, { step: 2 }, { action: action as never, binding: { spec: { kind: 'click' }, actionId: 'a' } as never, viewId: 'main', apple: false });
  expect(p).toMatchObject({ viewId: 'main', roles: { fine: true }, step: 2 });
});
