import { describe, expect, it } from 'vitest';
import { settle } from './fontCascade';

describe('settle', () => {
  it('waits for markup a story only puts in after its first commit', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    setTimeout(() => (host.innerHTML = '<p>loaded</p>'), 70);
    await settle();
    expect(host.innerHTML).toBe('<p>loaded</p>');
    host.remove();
  });

  it('waits for a portal that fills in after the story itself holds still', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    host.innerHTML = '<p>story</p>';
    const portal = document.body.appendChild(document.createElement('div'));
    setTimeout(() => (portal.innerHTML = '<p>loading</p>'), 70);
    setTimeout(() => (portal.innerHTML = '<p>popover</p>'), 130);
    await settle();
    expect(portal.innerHTML).toBe('<p>popover</p>');
    host.remove();
    portal.remove();
  });
});
