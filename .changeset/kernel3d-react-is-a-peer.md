---
'@weasel-js/kernel3d': patch
---

`@weasel-js/kernel3d` no longer ships its own copy of React. `useOrbitTool` imports `useMemo`, the manifest did not declare `react`, and the build inlined it: `dist/index.js` carried React's production and development builds, so the hook ran on a copy of React the app's renderer never drives. `react` is now a peer dependency (`>=18`) and the bundle imports it; `dist/index.js` goes from 84 KB to 17 KB.
