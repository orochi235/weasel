---
'@weasel-js/ui': patch
---

Adds behavior: `s` in a `BandEditor` splits the selected band at the middle of its drawn span, so on a log scale the two halves are equally wide. Splitting was the one edit with no key; clicking the ruler was the only way. The selection stays on the left half, and the new band's payload comes through `splitBand` as it does for a click. The key and the rule were chosen on an agent's judgment. Like `x` and `l`, a modified `s` and one typed into a field inside a band are left alone.
