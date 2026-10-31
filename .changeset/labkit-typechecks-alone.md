---
'@weasel-js/labkit': patch
---

labkit's `tsconfig.json` now extends the repo's root config like every other package, so an editor
reads labkit against its siblings' source, and `src/css.d.ts` declares the plain `.css` and `.less`
stylesheets labkit imports for their side effect.
