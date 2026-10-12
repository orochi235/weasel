---
'@weasel-js/core': patch
---

A target can be read as numbers. `target.readInto(out, at?)` writes the value on screen as its axes into a `Float64Array`, `Float32Array`, or array the caller owns, `target.axisCount` numbers from `at`, with no value built: for a painter reading thousands of targets a frame.

`TargetAxes` takes two optional functions that make reads cheaper. `add(value, delta)` answers the value with a delta applied axis by axis, and `read()` uses it to skip the array of axes it used to build. `write(value, out, at)` puts a value's axes straight into a buffer, for `readInto`. Every axes mapping the kit supplies defines both: the default for a number, an array, or an object of numbers, `RECT_POSE_DESCRIPTOR`, `pathPoseDescriptor`, `viewAxes`, and `skeletonAxes`. Axes without them work as before.
