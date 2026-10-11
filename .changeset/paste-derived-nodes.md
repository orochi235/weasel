---
'@weasel-js/core': patch
---

Copy and paste through a scene adapter now carries a node's derivation and a container's layout. A pasted node that derives from an id list follows the pasted copies of what it depends on; one whose dependencies were not all copied is left out of the paste rather than pasted as an invisible placeholder, and the paste says so: `commitPaste`'s ctx takes `onOmit`, `useClipboardOps` takes `onPasteOmitted`, and `<SceneCanvas ingestion={{ clipboard: { onOmitted } }}>` hears the same for an OS-clipboard paste (new types `PasteOmission` and `PasteCtx`). Snapshot items also carry `SceneRegistry` keys for their function fields, so a registered `derivePath`, `derivePose`, `clipFromPose`, or `layout` survives the JSON wire format.
