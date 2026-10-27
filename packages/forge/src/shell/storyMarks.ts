import type { AnnotationsCapability, CaptureSource } from '@weasel-js/labkit';
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

/**
 * A story host as an SVG picture: its DOM inside a `<foreignObject>`, with the document's stylesheets beside it.
 *
 * The capture root is a `<div>`, so nothing a rule hangs off `:root`, `html` or `body` reaches the story — hence the
 * custom properties, as they resolve on the host, restated on the root: theme tokens travel by them.
 */
export function captureHost(host: HTMLElement): Extract<CaptureSource, { kind: 'svg' }> {
  const doc = host.ownerDocument;
  const w = Math.max(1, host.offsetWidth);
  const h = Math.max(1, host.offsetHeight);
  const root = doc.createElement('div');
  root.setAttribute('data-fg-capture', '');
  const tokens = scanCssVars(doc, undefined, host)
    .filter((v) => v.value)
    .map((v) => `${v.name}: ${v.value};`)
    .join('');
  const style = doc.createElement('style');
  style.textContent = `${documentCss(doc)}\n[data-fg-capture]{${tokens}}`;
  root.append(style, host.cloneNode(true));
  // XML, not HTML: an `<svg>` base is parsed again as XML, where `<br>` and friends have to be closed.
  const inner = new XMLSerializer().serializeToString(root);
  return {
    kind: 'svg',
    markup: `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${inner}</foreignObject></svg>`,
  };
}

/**
 * The story's host as the one region of a trial that takes marks. Its content box is the host's layout size, which
 * a zoomed stage leaves alone, and an export draws the marks over a capture of the host.
 */
export function storyMarks(hosts: StoryHosts): AnnotationsCapability<unknown, unknown> {
  return {
    targets: (_state, _config, trial) => {
      const ref = hosts.ref(trial.id);
      const host = ref.current;
      return [
        {
          id: 'story',
          ref,
          content: { w: Math.max(1, host?.offsetWidth ?? 0), h: Math.max(1, host?.offsetHeight ?? 0) },
          base: () => {
            if (!ref.current) throw new Error('[forge] the story has no host to capture');
            return captureHost(ref.current);
          },
        },
      ];
    },
  };
}
