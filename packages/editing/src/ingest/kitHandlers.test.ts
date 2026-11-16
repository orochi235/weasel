import { describe, it, expect } from 'vitest';
import { handlersFor } from '@weasel-js/core';
import { KIT_CONTENT_HANDLERS } from './kitHandlers';

describe('KIT_CONTENT_HANDLERS', () => {
  it('runs the copied-nodes handler ahead of the SVG and image handlers', () => {
    expect(handlersFor(KIT_CONTENT_HANDLERS).map((h) => h.id)).toEqual([
      'kit:weasel-json', // priority -50
      'kit:svg',
      'kit:image',
    ]);
  });
});
