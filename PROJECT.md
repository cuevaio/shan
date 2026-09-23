# Shan

This file is public. Do not include personal context, private goals, names of
people from the vault, health information, private decisions, or local vault
paths.

**Last updated:** 2026-09-23  
**Status:** active  
**Type:** landing

## Goal

Give a person a page of images they can point at and set in motion by drawing
with the cursor.

## Done when

- The landing is one page with a small set of images.
- A toolbox opens from a mark fixed to the bottom of the viewport.
- A chosen image can play a cursor stroke, and a model reading of that stroke when a key is set.

## Current state

The demo page is a private-account landing called Sable: a card, a transfer, and a member. A chosen picture on the page opens a toolbox beside it. Without an API key the picture follows a local cleanup of the stroke. With `NEBIUS_API_KEY`, refine sends the path coordinates to Nebius Token Factory and plays the named motion it returns.

## Next action

Set `NEBIUS_API_KEY` and compare a shaky circle with the orbit reading.

## Links

- Repository: https://github.com/shiarauzo/shan
- Production:
- Documentation:
