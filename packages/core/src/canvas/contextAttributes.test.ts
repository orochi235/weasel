import { describe, expect, it } from 'vitest';
import { RENDERER_CONTEXT_ATTRIBUTES } from '@weasel-js/renderer/test-seams';
import { CANVAS_CONTEXT_ATTRIBUTES } from './contextAttributes';

describe('CANVAS_CONTEXT_ATTRIBUTES', () => {
  it('asks for what the renderer opens a canvas with, so either may open it first', () => {
    expect(CANVAS_CONTEXT_ATTRIBUTES).toEqual(RENDERER_CONTEXT_ATTRIBUTES);
  });
});
