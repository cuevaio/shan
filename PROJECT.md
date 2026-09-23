# Shan

This file is public. Do not include personal context, private goals, names of
people from the vault, health information, private decisions, or local vault
paths.

**Last updated:** 2026-09-23  
**Status:** active  
**Type:** monorepo

## Goal

Give a person a page of images they can point at and set in motion by drawing
with the cursor.

## Done when

- The landing is one page with a small set of images.
- A toolbox opens from a mark fixed to the bottom of the viewport.
- A chosen image can play a cursor stroke, and a model reading of that stroke when a key is set.

## Current state

The repository is a Turborepo with a publishable `nebi-agent` package and two Next.js examples. The Shan example is a private-account landing called Sable: a card, a transfer, and a member. A chosen picture opens a toolbox beside it. Without an API key the picture follows a local cleanup of the stroke. With `NEBIUS_API_KEY`, refine sends the path coordinates to Nebius Token Factory and plays the named motion it returns. The Nebi example demonstrates prompt-driven live code editing with keep and discard controls.

## Next action

Set `NEBIUS_API_KEY` and compare a shaky circle with the orbit reading.

## Links

- Repository: https://github.com/shiarauzo/shan
- Production:
- Documentation:
