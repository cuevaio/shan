# Shan

Shan lets a person point at a rendered interface, show visual intent, and preview a code change without leaving the page.

## Language

**Page**:
The open interface a person is viewing in the browser.
_Avoid_: app, canvas, document

**Editor**:
The floating Shan panel used to select context, draw, prompt, and review changes.
_Avoid_: toolbox, plugin, extension

**Element**:
One selectable part of the Page, such as an image, heading, card, or section.
_Avoid_: block, object, layer

**Selection**:
The Element currently attached as context for a Drawing Note, Motion Preview, or Prompt.
_Avoid_: target, focus

**Drawing Note**:
A freehand line over the Page that communicates visual or motion intent.
_Avoid_: stroke, gesture, annotation

**Motion Preview**:
A temporary movement played directly on the Selection without changing the Page's source.
_Avoid_: final animation, code change

**Prompt**:
A written request for a source change. It is global without context and contextual when it includes a Selection or Drawing Note.
_Avoid_: command, instruction

**Change Preview**:
A proposed source change applied temporarily so a person can try it before keeping or discarding it.
_Avoid_: commit, final change
