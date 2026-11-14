---
'@weasel-js/core': major
'@weasel-js/geom': major
'@weasel-js/path-tools': major
---

The Blend path effect is now Tween, and every name it carried changes with it; this is breaking, with no aliases. Color blending, `blendMode`, and the renderer's blend state are unrelated and keep their names.

| Before | After |
|---|---|
| path effect `kind: 'blend'`, `BlendEffect` (core) | `kind: 'tween'`, `TweenEffect` |
| action `blend`, `blendAction` | `tween`, `tweenAction` |
| actions `setBlendSpine`, `releaseBlendSpine`, `setBlendSpineAction`, `releaseBlendSpineAction` | `setTweenSpine`, `releaseTweenSpine`, `setTweenSpineAction`, `releaseTweenSpineAction` |
| the path-effect settings form's `blends` count | `tweens` |
| `blendPaths`, `prepareBlend`, `BlendPathsOptions`, `PathBlend` (`@weasel-js/geom`, re-exported by core) | `tweenPaths`, `prepareTween`, `TweenPathsOptions`, `PathTween` |
| icons `path-tools:blend`, `path-tools:setBlendSpine`, `path-tools:releaseBlendSpine` | `path-tools:tween`, `path-tools:setTweenSpine`, `path-tools:releaseTweenSpine` |

The action keeps its key. A document saved with a live blend needs that node's `data.pathEffect.kind` rewritten to `'tween'`.

```ts
// before
pathEffectNode({ kind: 'blend', steps: 3 }, [a, b], 'main', PATH_EFFECT_DERIVATIONS);
// after
pathEffectNode({ kind: 'tween', steps: 3 }, [a, b], 'main', PATH_EFFECT_DERIVATIONS);
```

<!-- entry: rank=5 breaking api data -->
