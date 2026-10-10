import { ActionsProvider, SelectionContextProvider } from '@weasel-js/core';
import { registerFont, registerFontOutlines } from '@weasel-js/core/renderer';
import { WeaselDemos } from './WeaselDemos';

// Register the bundled Inter MSDF atlas as the default `sans-serif` family so
// every demo's text DrawCommands render. The GL backend's drawText silently
// drops glyphs when no atlas is registered for the requested family/variant.
// Atlases live under `assets/fonts/` (vite publicDir).
// Atlas paths are base-prefixed: vite config sets `base: '/weasel/'` so
// publicDir-served URLs live under that prefix. Using bare `/inter/...`
// produces a silent 404 → atlas never loads → text DrawCommands drop
// every glyph and the canvas stays blank until edit mode (which uses a
// contenteditable overlay, not the GL pipeline).
// Lazy: fetched the first time text lays out, so a demo with none never pays
// for it. `<SceneCanvas>` subscribes to `subscribeGlyphReady`, which
// `registerFont` fires on success, so text that painted nothing repaints once
// the atlas lands.
void registerFont(
  'sans-serif',
  { weight: 400, style: 'normal' },
  `${import.meta.env.BASE_URL}inter/inter.json`,
  `${import.meta.env.BASE_URL}inter/inter.png`,
  { lazy: true },
).catch((err) => {
  console.warn('weasel demo: failed to register default font', err);
});

// The file the atlas was baked from. Large text draws from its outlines, and
// the text edit overlay sets its glyphs in it, so editing shows the same face
// the canvas draws. Fetched on first use.
registerFontOutlines(
  'sans-serif',
  { weight: 400, style: 'normal' },
  `${import.meta.env.BASE_URL}inter/inter.ttf`,
);

// Top-level <ActionsProvider> consolidates standalone hooks
// (useSelectAll / useEscape / etc.) onto a single keydown listener.
// Each demo's hook still works — when a registry is in scope, the hook
// registers an Action with the registry instead of attaching its own
// document keydown listener (back-compat path lives in each hook).
export default function Shell() {
  return (
    <ActionsProvider>
      <SelectionContextProvider>
        <WeaselDemos />
      </SelectionContextProvider>
    </ActionsProvider>
  );
}
