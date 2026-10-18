/**
 * A kit canvas brings its own size rule. jsdom resolves neither `var()` nor
 * `:where()` into a layout, so these assert the rule's text and where it is
 * held; the size it gives the element is `DrawCanvas.browser.test.tsx`'s job.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SURFACE_RULE, SurfaceCanvas, __resetSurfaceRule, adoptSurfaceRule } from './SurfaceCanvas';

type StyleRoot = Document | ShadowRoot;

/** Every rule `root` holds, adopted or in a `<style>`. */
function rulesIn(root: StyleRoot): string[] {
  const adopted = (root.adoptedStyleSheets ?? []).flatMap((sheet) =>
    Array.from(sheet.cssRules, (rule) => rule.cssText));
  const inline = Array.from(root.querySelectorAll('style'), (el) => el.textContent ?? '');
  return [...adopted, ...inline];
}

const holdsRule = (root: StyleRoot): number =>
  rulesIn(root).filter((text) => text.includes('[data-wzl-surface]')).length;

beforeEach(() => {
  __resetSurfaceRule();
  document.adoptedStyleSheets = [];
  document.head.querySelectorAll('style').forEach((el) => el.remove());
});

describe('<SurfaceCanvas>', () => {
  it('marks the canvas and carries its size as custom properties', () => {
    const { container } = render(<SurfaceCanvas width={30} height={20} className="mine" />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.hasAttribute('data-wzl-surface')).toBe(true);
    expect(canvas.className).toBe('mine');
    expect([canvas.style.width, canvas.style.height]).toEqual(['', '']);
    expect(canvas.style.getPropertyValue('--wzl-surface-width')).toBe('30px');
    expect(canvas.style.getPropertyValue('--wzl-surface-height')).toBe('20px');
  });

  it('sizes from those properties at zero specificity', () => {
    expect(SURFACE_RULE).toContain(':where([data-wzl-surface])');
    expect(SURFACE_RULE).toContain('width: var(--wzl-surface-width, 100%)');
    expect(SURFACE_RULE).toContain('height: var(--wzl-surface-height, 100%)');
  });

  it('lets a filling canvas shrink inside its parent at zero specificity', () => {
    expect(SURFACE_RULE).toContain(":where([data-wzl-surface='fill'])");
    expect(SURFACE_RULE).toContain('contain: size');
  });

  it('holds the rule in the document it mounts in, once however many mount', () => {
    expect(holdsRule(document)).toBe(0);
    render(<><SurfaceCanvas width={1} height={1} /><SurfaceCanvas width={2} height={2} /></>);
    expect(holdsRule(document)).toBe(1);
  });

  it('hands the canvas to a forwarded ref', () => {
    let seen: HTMLCanvasElement | null = null;
    const { container } = render(<SurfaceCanvas width={1} height={1} ref={(el) => { seen = el; }} />);
    expect(seen).toBe(container.querySelector('canvas'));
  });
});

describe('adoptSurfaceRule', () => {
  it('gives a shadow root a rule of its own', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const canvas = document.createElement('canvas');
    shadow.appendChild(canvas);
    adoptSurfaceRule(canvas);
    adoptSurfaceRule(canvas);
    expect(holdsRule(shadow)).toBe(1);
    expect(holdsRule(document)).toBe(0);
    host.remove();
  });

  it('gives a second document a rule of its own', () => {
    const other = document.implementation.createHTMLDocument('popout');
    const canvas = other.createElement('canvas');
    other.body.appendChild(canvas);
    adoptSurfaceRule(canvas);
    expect(holdsRule(other)).toBe(1);
  });
});
