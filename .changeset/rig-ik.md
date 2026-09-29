---
'@weasel-js/core': patch
---

Add `solveIk`, a 2D inverse-kinematics solver for the rig. Given a skeleton, a pose, a chain of joints and a target, it returns the pose with the chain's rotations replaced so the chain's tip reaches the target — an ordinary `Pose`, so it blends with `blendPoses`, samples on a `SampledTrack<Pose>` and drives `Rig.pose`. It solves by cyclic coordinate descent, with per-joint angle limits, an iteration cap and a tolerance; a two-joint chain is solved analytically first, bending toward an optional `pole`. A target out of reach leaves the chain pointing straight at it, and the result says whether the target was reached. New types: `SolveIkOptions`, `IkResult`, `IkLimit`, `IkPoint`. Additive.
