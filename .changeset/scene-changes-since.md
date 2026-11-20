---
'@weasel-js/core': minor
---

`scene.changesSince(token)` answers which nodes changed since an earlier call, so an index over a scene updates those nodes alone.

The answer names every node an edit reached — the nodes it named, their descendants, the nodes deriving from them, and those a pose preview or a scroll set or cleared — with the containers whose children changed and whether the render order moved. It is `'unknown'` without a token, after a consumer's op, a layer change, or once its bounded journal no longer reaches back to the token: start over from the whole scene then.

```ts
let { token } = scene.changesSince();
// …later
const changed = scene.changesSince(token);
token = changed.token;
if (changed.ids === 'unknown') rebuildAll();
else for (const id of changed.ids) refresh(id);
```

<!-- entry: rank=5 new api -->
