# Line Breaking Algorithm conformance fixture

Unicode's own test data for UAX #14, read by `../conformance.test.ts`.

**Unicode 16.0.0**: `LineBreakTest.txt.gz` is the complete upstream
[`LineBreakTest.txt`](https://www.unicode.org/Public/16.0.0/ucd/auxiliary/LineBreakTest.txt),
nothing subsetted or reordered, gzipped because it is 3 MB uncompressed and
190 KB compressed. `gzip -9 -n` is deterministic, so re-compressing the same
download reproduces the same bytes.

To regenerate, matching the version in `../lineBreakTable.ts`:

```sh
curl -sSO https://www.unicode.org/Public/16.0.0/ucd/auxiliary/LineBreakTest.txt
gzip -9 -n LineBreakTest.txt
```

This file is a test fixture and must not ship in the published tarball.
