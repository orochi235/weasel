---
'@weasel-js/diagram': patch
---

A sequence's lifeline marks can be selected and deleted. An activation bar and a destruction's cross are taken hold of
on the canvas like a head or a message; Delete on a bar removes the marks or message flags that open and close it, and
on a cross the `destroy` mark. `SeqActivationPlace` names its `opener` and `closer` and `SeqLifelinePlace` its
`destroyedBy` as `SeqMarkRef`s, and the parts drawn for them carry those refs. `removeMarks` removes marks by their
places and clears message flags; `removeMarksOf` removes every mark of a kind naming a participant, such as the
`create` that draws a head partway down.
