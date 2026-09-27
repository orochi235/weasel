---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Every canvas now routes its own input. `<SceneCanvas>`, labkit's `<CanvasStack>` and `<Stage>` each mount an `<InputScope>` — an actions registry, dep registry and active tool of their own — under whatever registries are in scope, so two canvases under one provider no longer hand the newest one everyone's gestures. Registries above a canvas read through to the canvas last used: `trigger`, `begin`, `list` and `useActiveToolContext` there answer from the scope that last took a pointerdown or wheel, and keystrokes dispatch only in that scope.

Canvases that should share input join one yoke: `const yoke = useYoke()`, then `yoke={yoke}` on each canvas and `<Yoke value={yoke}>` around a toolbar. A canvas with no yoke keeps its own tool.

Breaking: `ActionsScope`, `ActionsRegistry.setDepRegistry` and labkit's `CameraScopeContext` are removed; `ActionsRegistry` gains `activate()` and `isActive()`, which a hand-built registry must now supply. A registration made inside one canvas is no longer visible from a sibling canvas — a registry above reaches it only through the active scope. A nested `<WeaselProvider>` now hands its children the outer registry itself.
