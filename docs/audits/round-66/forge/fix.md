configKey writes every Map and Set as `{}` (A): fixed 95a5055fd4
isPortSafe passes a Date, RegExp, buffer, or typed array with expando fields (A): fixed ffd4efd5f0
useArgs sends a forge-reserved key the shell drops, keeping no local copy (A): fixed 2521ae92dd
A leaf's `default` crosses the port unsanitized (B): fixed b95a44b38f (dataOf also drops a class instance or Map holding a function in annotations)
`argTypes.if` reads config, not the frame-local args the render sees (B): fixed 141b62fb70 (adds optional `LoadedStory.onAnswersStale`, minor changeset; the frame answers again when local args change)
`play` gets args without the frame-local ones (B): fixed c4c19f4764 (the timeline too)
`if: { eq: undefined }` tested as an equality (B): fixed 7b08e80884
[r47-1] non-string select/radio options vanish or become a free field (carried): not a defect (no longer applies: optionChoice takes any option with a string form and warns for the rest)
[r47-6] function-valued annotations in `ready` (carried): not a defect (no longer applies: describeShape runs annotations through dataOf)
[r47-8] description drops enableIf, auto, resettable, motif, dialog (carried): not a defect (enableIf, auto, and resettable are carried now; motif and dialog are ruled in docs/unruled.md, round 65 forge)
[r47-9] cleared clearable number writes no URL param (carried): not a defect (no longer applies: knobsToParams writes an empty param through isClearedKnob, and parsedKnob reads it back as cleared)
[r47-11] a Proxy arg gets a control and its default fails `ready` (carried): not a defect (no longer applies: isPortSafe and splittable both check structuredClone)

Extra:
configKey writes a config object with its own `$type` key the same as the NaN/Infinity tag (sweep): fixed fd4944b989
isPortSafe refuses an array or plain object from another realm, and the protocol property test failed once defaults went through portSafePart (sweep): fixed 487766c897

Checks:
- vitest, each file `--maxWorkers=1`: protocol/messages.test.ts pass (2), protocol/schema.test.ts pass (12), protocol/protocol.pbt.test.ts pass (4), csf/portSafe.test.ts pass (23), csf/argsToSchema.test.ts pass (57), csf/shims/preview-api.test.tsx pass (20), csf/loadCsfModule.test.tsx pass (27), csf/csf.pbt.test.ts pass (13), frame/FrameController.test.tsx pass (25)
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script ("Missing script: \"lint\""). Instead, eslint on every forge file changed: pass
- `npm run check:changesets`: "[changesets] OK — 10 changeset(s)."

tally: 7 of 12 fixed, 2 extra fixed