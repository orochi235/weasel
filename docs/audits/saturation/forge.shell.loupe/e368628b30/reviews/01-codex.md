# Review saturation for `forge.shell.loupe`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 19 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Capture payload validation and structured state | 1 | 1 | 0 |
| 2 | Capture and Live comparison parity for story globals | 1 | 2 | 0 |
| 3 | Capture request ordering, image ownership, and source status | 0 | 2 | 1 |
| 4 | Live copy placement, scrolling, and reticle coordinates | 0 | 2 | 2 |
| 5 | Contrast sampling, token chains, and comparison controls | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Cyclic story state overflows before capture can report it as unsupported

[capturePayload.ts](packages/forge/src/shell/loupe/capturePayload.ts#L88) · Pass 1 · Medium · Source-traced

capturePayload strips undefined fields recursively before it runs the guarded JSON check. A cyclic plain object or array in story state recurses until it throws, bypassing STATE_UNSENDABLE. A cycle in config similarly bypasses CONFIG_UNSENDABLE on the next normalization. Story state transferred through structured clone can contain such cycles, and the attached Pixels lens invokes payload construction outside its request error handler.

### 2. Pixels capture omits the story's declared globals from its host conditions

[capturePayload.ts](packages/forge/src/shell/loupe/capturePayload.ts#L125) · Pass 2 · Medium · Source-traced

The payload resolves globals from the lab, trial pins, and comparison only, since CaptureInputs does not publish story globals. TrialHost and the isolated story session both overlay the story's declarations on those values. CaptureView applies payload.globals directly to the host, so a story declaring dark mode can be captured with light-mode styles while its Live preview uses dark mode.

Source and tests were left untouched.
