---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
'@weasel-js/core': major
---

The Extend to next path tool is now Reach, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `useExtendTool`, `UseExtendToolOptions` | `useReachTool`, `UseReachToolOptions` |
| `extendPreset`, preset id `'extend'` | `reachPreset`, `'reach'` |
| tool id and `PathToolId` `'extend'` | `'reach'` |
| action `extendToMeet`, `extendToMeetAction`, `EXTEND_TO_MEET_PARAMS`, `ExtendToMeetParams` | `reachToMeet`, `reachToMeetAction`, `REACH_TO_MEET_PARAMS`, `ReachToMeetParams` |
| `extendToMeet`, `ExtendToMeetOptions` (`@weasel-js/geom`, re-exported by core) | `reachToMeet`, `ReachToMeetOptions` |
| icon `path-tools:extend` | `path-tools:reach` |

The tool keeps its Shift+U key.

```ts
// before
const extend = useExtendTool();
<SceneCanvas features={['draw', extendPreset]} tools={{ extend }} tune={{ extendToMeet: { params: { shape: 'straight' } } }} />
// after
const reach = useReachTool();
<SceneCanvas features={['draw', reachPreset]} tools={{ reach }} tune={{ reachToMeet: { params: { shape: 'straight' } } }} />
```

<!-- entry: rank=5 breaking api -->
