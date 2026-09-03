---
'@weasel-js/ui': patch
---

Add `ChevronIcon`, and use it for the disclosure in `SidebarPanel` and
`<Timeline>`'s lane labels.

Both were rendering a literal `▾` character at 10px. A text glyph is not
centred in its em box — `▾` sits low and narrow inside a box that is not even
square — so `rotate(-90deg)` swung the visible triangle through an arc instead
of spinning it in place, moving it 4.0px across and 3.6px down. The new glyph's
ink centroid is placed at the centre of the 20×20 viewBox (the stroked region's
first moment, not the path's bounding box: two round caps outweigh the single
join at the vertex, so the mass sits above the bbox centre), and the icon's
box is square, so the rotation is concentric to within 0.005px.

16px in `SidebarPanel` and 14px in a timeline lane are the smallest sizes at
which both arms and the vertex land solid ink on the 1× device grid.
