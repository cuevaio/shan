# Shan

A person visits a page and gives a block a named motion. When they draw, the curve comes from that stroke.

## Language

**Page**:
The open surface a person visits in the browser. No account, no install.
_Avoid_: lámina, app, download, signup

**Toolbox**:
A panel on the Page.
_Avoid_: plugin, extension, install

**Block**:
One selectable thing on the Page. An image, a card, or a loose letter, each treated as a single object.
_Avoid_: elemento, objeto, layer, glyph

**Stroke**:
The path a person draws with the cursor to show how a Block should move.
_Avoid_: trazo, gesture, path

**Prompt**:
A written line that describes how a Block should move. It resolves to one Motion and uses that Motion's own curve.
_Avoid_: texto, comando

**Reading**:
What the model is shown: the selected Block, and the Stroke in full, curves included. Not the whole Page, and not a straightened stroke.
_Avoid_: página entera, coordenadas, trazo recto

**Motion**:
A named movement from a fixed list: Spiral, Drift, Settle, or Zoom. Zoom is one Motion; in and out are its direction. Each Motion has its own curve, used when a Prompt names it. A Stroke also resolves to one Motion.
_Avoid_: animación

**Curve**:
The line a Block follows. From a Stroke, the Curve is taken from that Stroke. From a Prompt, the Curve is the one that belongs to the named Motion.
_Avoid_: trazo crudo

**Refine**:
The cleanup of a Curve taken from a Stroke. Jitter goes. Curves stay. A Prompt is not refined.
