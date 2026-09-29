/**
 * Wait until the edit overlay in `host` is mounted and set in its own face.
 *
 * `document.fonts.ready` alone cannot do it: unless the canvas has already
 * read the face's bytes, its private face joins `document.fonts` only when the
 * edit starts, after a `flushSync` render has returned, so `ready` read then
 * belongs to an empty set and resolves at once. And past the overlay's short
 * font hold it shows in the fallback, which a loaded test machine can reach.
 * `overlayFaceLoad.browser.test.tsx` checks the overlay itself; this is for
 * tests about something else.
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
