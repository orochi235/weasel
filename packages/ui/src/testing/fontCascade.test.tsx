import { describe, expect, it } from 'vitest';
import { settle } from './fontCascade';

describe('settle', () => {
  it('waits for markup a story only puts in after its first commit', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    setTimeout(() => (host.innerHTML = '<p>loaded</p>'), 70);
    await settle(host);
    expect(host.innerHTML).toBe('<p>loaded</p>');
    host.remove();
  });
});
