---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
---

`<Canvas>` and `<SceneCanvas>` take an `imageMinification` prop, forwarded to the renderer: `'auto'` builds an image's mipmaps the first time a frame draws it at half size or smaller, so a large bitmap drawn small stops aliasing. The default stays `'linear'`. `WeaselRenderer.setImageMinification` changes the strategy after construction; a change frees every image texture, and each re-uploads when next drawn.
