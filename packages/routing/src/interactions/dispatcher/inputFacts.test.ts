import { expect, it } from 'vitest';
import { immediateParams } from './inputFacts';

it('gives a contextmenu its client point and body kind', () => {
  const p = immediateParams({
    kind: 'contextmenu', x: 1, y: 2, clientX: 30, clientY: 40,
    bodyTarget: 'selected-body', bodyKind: 'text',
    shiftKey: false, altKey: false, metaKey: false, ctrlKey: false,
  } as never, undefined);
  expect(p).toMatchObject({ world: { x: 1, y: 2 }, clientX: 30, clientY: 40, bodyTarget: 'selected-body', bodyKind: 'text' });
});
