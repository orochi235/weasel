---
'@weasel-js/labkit': minor
---

`labRoutes()` from `@weasel-js/labkit/vite` serves each page of a lab at its URL without `.html`, in `vite` and `vite preview`.

A document request for `/snap` gets `snap.html`, query kept, even where a module named `snap.tsx` would otherwise answer it. Add it to the Vite config:

```ts
import { labRoutes } from '@weasel-js/labkit/vite';

export default defineConfig({ plugins: [react(), labRoutes()] });
```

`vite` is an optional peer; only this subpath loads it.

<!-- entry: rank=10 new api -->
