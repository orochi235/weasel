import { describe, expect, it } from 'vitest';
import { createStencilTool } from './stencilTool';

describe('createStencilTool', () => {
  it('carries the stencil’s description into its presentation, and leaves it out when there is none', () => {
    expect(createStencilTool({ id: 'box', label: 'Box', description: 'A plain box' }).presentation)
      .toMatchObject({ label: 'Box', description: 'A plain box', group: 'stencil' });
    expect(createStencilTool({ id: 'box', label: 'Box' }).presentation).not.toHaveProperty('description');
  });
});
