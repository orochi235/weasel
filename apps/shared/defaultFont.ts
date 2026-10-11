import { registerFont, registerFontOutlines } from '@weasel-js/core/renderer';

/**
 * Register the bundled Inter as the default `sans-serif` family, from the
 * `inter/` files each app serves out of its vite `publicDir`. `app` names the
 * caller in the warning a failed atlas load logs.
 *
 * Two tiers of one face, cut to the same charset (U+0020–00FF) so neither can
 * draw a character the other cannot: the MSDF atlas, and the TTF whose
 * outlines the kit tessellates above about 48 on-screen pixels and the text
 * edit overlay sets its glyphs in. Both are fetched on first use.
 */
export function registerDefaultFont(app: string): void {
  // Base-prefixed: a bare `/inter/…` 404s silently under a vite `base`, and
  // with no atlas the GL backend drops every glyph.
  const url = (file: string) => `${import.meta.env.BASE_URL}inter/${file}`;
  const variant = { weight: 400, style: 'normal' } as const;
  void registerFont('sans-serif', variant, url('inter.json'), url('inter.png'), { lazy: true })
    .catch((err) => {
      console.warn(`${app}: failed to register default font`, err);
    });
  registerFontOutlines('sans-serif', variant, url('inter.ttf'));
}
