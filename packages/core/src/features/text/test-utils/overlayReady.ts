/**
 * Wait until the edit overlay in `host` is mounted and set in its own face.
 *
 * `document.fonts.ready` alone cannot do it: the overlay's private face joins
 * `document.fonts` only when the edit starts, after a `flushSync` render has
 * returned, so `ready` read then belongs to an empty set and resolves at once.
 * Measured that early, the overlay is in the fallback face.
 */
export async function overlayReady(host: HTMLElement): Promise<HTMLElement> {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  let el = host.querySelector<HTMLElement>('[contenteditable]');
  for (let i = 0; !el && i < 60; i++) {
    await frame();
    el = host.querySelector<HTMLElement>('[contenteditable]');
  }
  if (!el) throw new Error('the edit overlay never mounted');
  const css = getComputedStyle(el);
  await document.fonts.load(`${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`);
  await document.fonts.ready;
  await frame();
  await frame();
  const families = css.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
  const unloaded = [...document.fonts]
    .filter((f) => families.includes(f.family) && f.status !== 'loaded')
    .map((f) => `${f.family}: ${f.status}`);
  if (unloaded.length) throw new Error(`overlay measured before its face loaded (${unloaded.join(', ')})`);
  return el;
}
