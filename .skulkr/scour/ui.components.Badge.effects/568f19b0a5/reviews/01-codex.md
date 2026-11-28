# Review saturation for `ui.components.Badge.effects`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 22 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Repeated outline effects, crawl phase, and range masks | 1 | 1 | 0 |
| 2 | Bevel and glass stroke endpoints and seams | 0 | 1 | 1 |
| 3 | SVG masks, clipping, and effect coordinates | 0 | 1 | 2 |
| 4 | Parameter defaults, effect zones, and variant gating | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Irregular puffs jump when the badge crawl restarts its cycle

[Puffs.tsx](packages/ui/src/components/Badge/effects/Puffs.tsx#L25) · Pass 1 · Low · Source-traced

The crawl phase wraps from one back to zero. At that boundary, bump centers line up because they are spaced one phase period apart, but each center's index shifts by one. With nonzero irregularity, the height is derived from that index, so the height at a center changes abruptly as the phase wraps. The moving outline can visibly jump at the end of each crawl cycle.

Source and tests were left untouched.
