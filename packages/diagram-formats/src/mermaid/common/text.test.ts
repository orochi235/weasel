import { describe, expect, it } from 'vitest';
import { mermaidIds } from './text';

describe('mermaidIds', () => {
  it('never picks a reserved id for a renamed one', () => {
    const classes = mermaidIds(['direction']);
    expect(classes.get('direction')).toBe('direction_');
    const namespaces = mermaidIds(['direction['], { reserved: [...classes.values()] });
    expect(namespaces.get('direction[')).not.toBe('direction_');
  });
});
