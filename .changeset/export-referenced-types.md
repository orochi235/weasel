---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/font': patch
'@weasel-js/forge': patch
'@weasel-js/guides': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
'@weasel-js/paint': patch
'@weasel-js/quantity': patch
'@weasel-js/renderer': patch
'@weasel-js/routing': patch
'@weasel-js/svg': patch
'@weasel-js/text-dom': patch
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Types a public signature names are exported now, so a consumer can write them down and the API reference links to them. All additions; nothing is renamed or removed.

- core: `ViewLike`, `TargetTransform`, `WeightEnv`.
- diagram: `DiagramRouter`, `DiagramTextStyle`, `DiagramDerivePose`, `Forest`.
- font: `DynamicFace`.
- forge: `ArgCondition`, `ComponentHistory`, `StoryGlobals`, `StoryLayout`, `StoryViewport`, `TimelineSpan`; from `/frame`, `Channel`, `ToFrame`, `FromFrame`, `ConfigAnswers`, `FaultPhase`; from `/shell`, `StoryRegistryOptions`, `StoryChanges`, `IndexEntry`, `CssVarReport`, `TrialFrameCalls`, `Libraries`, `SchemaDescription`, `DescribedShape`, `DescribedEntry`, `SectionDescription`.
- guides: `SnapToGuidesInsertArgs`, `SnapToGuidesMoveArgs`, and `SnapToGuidesResizeArgs`, each from its own subpath.
- hud: `AttachHudOptions`, `SourceRect`, `LoupeBaseOptions`.
- labkit: `MarkPose`, `AnnotationStorage`, `PaintedMark`, `ControlPanelProps`, `ControlPack`, `LoupeBindings`; from `/state`, `InstrumentHooks`; from `/config`, `Branching`, `Fields`, `FieldValues`, `Variants`, `VariantValues`.
- paint: `InCommandUnits`, `WithPatternHandle`.
- quantity: `FractionOptions`.
- renderer: `ShaderStage`, `UniformArray`.
- routing: `ToolScopes`.
- svg: `SvgDraftPose`.
- text-dom: `OverlayRunBase`.
- theme: `DtcgDocument`; from `/engine`, `SemanticCommon`, `DtcgGroup`, `DtcgAxesExtension`, `DtcgLayer`.
- ui: `ButtonBase`, `ButtonRegular`, `ButtonIconOnly`, `ToggleBarCommonProps`, `ToastFn`, `Fold`, `DistributiveOmit`, `WalkCtx`, `OverlayPoint`, `DocumentCodec`, `OpenedDocument`, `SchemaRoot`, `AnyNode`, `CurveSamplePoint`.

The names for types that had none of their own to export under (`StoryGlobals`, `TimelineSpan`, `CurveSamplePoint`, the `Diagram*` three, `ShaderStage`, `DtcgGroup`, `ToggleBarCommonProps`) were chosen by an agent.
