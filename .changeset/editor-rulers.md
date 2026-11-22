---
'@weasel-js/editor': minor
---

`useEditorRulers` gives an editor rulers and the guides dragged off them, shown by a `rulersSchema` setting.

Pass it the setting's values and setter and the unit scope the rulers read in. It answers whether they are shown, a toggle, the rulers to install on the canvas and draw with `<Rulers>` while shown, the guides' layer, and a snap source for the guides. The guides last as long as the component; a document does not save them.

<!-- entry: new api -->
