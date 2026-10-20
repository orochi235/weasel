/** The Theme panel's layout in a real browser: it fits the Format sidebar, every control in it can be
 *  scrolled to inside the sidebar, and the page itself never scrolls. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@weasel-js/theme/tokens.css';
import '../page.css';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';

/** Beside this file, where `.gitignore` keeps it out of the tree; vite serves nothing outside the repo. */
const SHOT = '__screenshots__/theme-panel.png';

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

async function menu(...path: (string | RegExp)[]): Promise<void> {
  for (const name of path) await userEvent.click(page.getByRole('menuitem', { name }).first());
}

/** Whether `inner` lies inside `outer`, to within half a pixel. */
const within = (inner: DOMRect, outer: DOMRect): boolean =>
  inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
  && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;

describe('the Theme panel', () => {
  it('fits the Format sidebar, scrolls inside it, and never scrolls the page', async () => {
    await mountChartApp();
    await menu('Format', /^Theme/, /^Edit Theme/);
    const sidebar = page.getByRole('complementary', { name: 'Format' }).element() as HTMLElement;
    await expect.poll(() => sidebar.querySelector('h2')?.textContent).toBe('Style');
    const panel = [...sidebar.querySelectorAll('h2')].find((h) => h.textContent === 'Theme')!;
    expect(panel).toBeTruthy();

    expect(sidebar.scrollWidth).toBeLessThanOrEqual(sidebar.clientWidth);
    expect(sidebar.scrollHeight).toBeGreaterThan(sidebar.clientHeight);
    const box = sidebar.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);

    const controls = [...sidebar.querySelectorAll<HTMLElement>('input, button, select, textarea, [role="combobox"]')];
    expect(controls.length).toBeGreaterThan(40);
    const stranded: string[] = [];
    for (const control of controls) {
      control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rect = control.getBoundingClientRect();
      if (rect.width === 0 || !within(rect, sidebar.getBoundingClientRect())) {
        stranded.push(control.getAttribute('aria-label') ?? control.textContent ?? control.tagName);
      }
    }
    expect(stranded).toEqual([]);
    expect(window.scrollY).toBe(0);

    sidebar.scrollTop = 0;
    window.scrollTo(0, 5000);
    expect(window.scrollY).toBe(0);
    expect(document.scrollingElement!.scrollTop).toBe(0);

    sidebar.scrollTop = panel.offsetTop - sidebar.offsetTop;
    await page.screenshot({ path: SHOT });
  });
});
