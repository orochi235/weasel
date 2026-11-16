import { describe, it, expect } from 'vitest';
import { handlersFor } from '@weasel-js/core';
import { KIT_CONTENT_HANDLERS } from '@weasel-js/editing';
import { textContentHandler } from './textHandler';

describe('textContentHandler beside the kit handlers', () => {
  it('runs last, so markup and node payloads in plain text go to the kit handlers first', () => {
    expect(textContentHandler.id).toBe('text-tools:text');
    expect(handlersFor([textContentHandler, ...KIT_CONTENT_HANDLERS]).map((h) => h.id)).toEqual([
      'kit:weasel-json', 'kit:svg', 'kit:image', 'text-tools:text',
    ]);
  });
});
