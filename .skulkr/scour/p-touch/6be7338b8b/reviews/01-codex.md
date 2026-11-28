# Review saturation for `p-touch`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Export command ordering and compositing across native and raster objects | 1 | 1 | 0 |
| 2 | Native text shaping, alignment, and XML eligibility | 0 | 1 | 1 |
| 3 | Carrier placement, clip geometry, and auto-length extents | 0 | 1 | 2 |
| 4 | Printer dot geometry, page splitting, and permission retry | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Destination-dependent groups lose preceding native artwork as their backdrop

[writeLbx.ts](packages/p-touch/src/lbx/writeLbx.ts#L145) · Pass 1 · P2 · Source-traced

Draw a solid black rectangle that maps to a native LBX object, then a group with composite destination-out whose opaque child overlaps part of that rectangle. The canvas erases the overlap. The exporter routes the group into a separate raster run because settle flushes at native object boundaries. commandRasterizer renders that run onto a clear target, so destination-out produces no ink and the crop emits no object. The native rectangle remains intact in the label and the export gives no skip reason. The same split removes the backdrop from other destination-dependent operators.

Source and tests were left untouched.
