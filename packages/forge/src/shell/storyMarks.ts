import type { AnnotationsCapability, CaptureSource, ContentWindow } from '@weasel-js/labkit';
import { scanCssVars } from '../frame/cssVars';
import type { StoryHosts } from './storyHosts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Every rule the document can read. A cross-origin sheet refuses, and is skipped. */
function documentCss(doc: Document): string {
  const out: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out.push(rule.cssText);
    } catch {
      // A cross-origin sheet refuses to be read.
    }
  }
  return out.join('\n');
}

/** Where a story host's content is: the box its scroller scrolls, and the part of that the host shows. */
export interface StoryBox {
  /** The scrolled content's size, never smaller than the host's own box. */
  content: { w: number; h: number };
  /** The host's layout box, at the scroller's offset into the content. */
  shown: ContentWindow;
}

/**
 * Measures `host` in its content's coordinates. The scroller fills the host, so a point of the content sits at the
 * same place in both once the scroll offset is taken off. Layout sizes, which a zoomed stage leaves alone.
 */
export function storyBox(host: HTMLElement | null): StoryBox {
  const w = Math.max(1, host?.offsetWidth ?? 0);
  const h = Math.max(1, host?.offsetHeight ?? 0);
  const scroller = host?.querySelector<HTMLElement>(':scope > .fg-story__scroll') ?? null;
  return {
    content: { w: Math.max(w, scroller?.scrollWidth ?? 0), h: Math.max(h, scroller?.scrollHeight ?? 0) },
    shown: { x: scroller?.scrollLeft ?? 0, y: scroller?.scrollTop ?? 0, w, h },
  };
}

/**
 * A story host's whole content as an SVG picture, however far it scrolls: its DOM inside a `<foreignObject>`, with
 * the document's stylesheets beside it, and the host's copy sized to the content so its scroller shows all of it.
 *
 * The capture root is a `<div>`, so nothing a rule hangs off `:root`, `html` or `body` reaches the story — hence the
 * custom properties, as they resolve on the host, restated on the root: theme tokens travel by them.
 */
export function captureHost(host: HTMLElement): Extract<CaptureSource, { kind: 'svg' }> {
  const doc = host.ownerDocument;
  const { w, h } = storyBox(host).content;
  const root = doc.createElement('div');
  root.setAttribute('data-fg-capture', '');
  const tokens = scanCssVars(doc, undefined, host)
    .filter((v) => v.value)
    .map((v) => `${v.name}: ${v.value};`)
    .join('');
  const style = doc.createElement('style');
  style.textContent = [
    documentCss(doc),
    `[data-fg-capture]{${tokens}}`,
    `[data-fg-capture] > .fg-story{width:${w}px;height:${h}px}`,
  ].join('\n');
  root.append(style, host.cloneNode(true));
  // XML, not HTML: an `<svg>` base is parsed again as XML, where `<br>` and friends have to be closed.
  const inner = new XMLSerializer().serializeToString(root);
  return {
    kind: 'svg',
    markup: `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${inner}</foreignObject></svg>`,
  };
}

/**
 * The story's host as the one region of a trial that takes marks. Marks live in the coordinates of the content the
 * host scrolls, so they move with it, and an export draws them over a capture of all of that content.
 */
export function storyMarks(hosts: StoryHosts): AnnotationsCapability<unknown, unknown> {
  return {
    targets: (_state, _config, trial) => {
      const ref = hosts.ref(trial.id);
      const { content, shown } = storyBox(ref.current);
      return [
        {
          id: 'story',
          ref,
          content,
          shown,
          base: () => {
            if (!ref.current) throw new Error('[forge] the story has no host to capture');
            return captureHost(ref.current);
          },
        },
      ];
    },
  };
}
