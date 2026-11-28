# Review saturation for `symmetry`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 11 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Wallpaper lattice collapse and scale dependence | 1 | 1 | 0 |
| 2 | Baking and authored affine precision | 1 | 2 | 0 |
| 3 | Guide drawing, hit geometry and nested copy reach | 0 | 2 | 1 |
| 4 | Drag preview, cancellation and controller subscriptions | 0 | 2 | 2 |
| 5 | Group normalization, pose rebasing and presets | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A small but regular wallpaper lattice is treated as collapsed

[wallpaper.ts](packages/symmetry/src/wallpaper.ts#L55) · Pass 1 · Medium · Source-traced

The collapse test multiplies the directional cross product by both spacings and compares the resulting cell area against an absolute threshold. Uniformly scaling down the lattice and its extent can suppress every copy even when the axes are perpendicular and the number of visible copies is modest.

### 2. Baking symmetry can flatten a node with a small authored scale

[bake.ts](packages/symmetry/src/bake.ts#L43) · Pass 2 · Low · Source-traced

carryPose applies its round-off cleanup to the entire composed affine, including existing pose coefficients. A real nonzero scale below 1e-12 is rounded to zero and the baked pose becomes singular even though its live counterpart still draws with a nonzero scale.

Source and tests were left untouched.
