# Pretotyping MVP Architecture

This MVP treats screenshots as source material, not as the final source of truth. The app starts with a screen library, lets a human add lightweight IA labels, then generates clickable prototype overlays from a natural-language request.

## Resource Model

- `resources/screens/*`: raw screen captures
- `data/screens.json`: first-pass screen inventory, dimensions, summaries, areas, states, and provisional flows
- Browser `localStorage`: user-edited metadata and generated prototype versions

For a complex app, screenshots alone are useful but insufficient. A good workflow is:

1. Upload or add screen captures.
2. Let AI create a first-pass inventory: screen name, visible areas, components, scroll depth, modal/sheet states, likely tabs.
3. Ask the product owner to correct names and flows.
4. Store the corrected metadata as the reusable context for future generation.

## Handling Complex Screens

Use four layers instead of one flat image folder:

- `Screen`: a route or major app view.
- `State`: a variation of a screen, such as default, scrolled, empty, loading, modal open, tab selected.
- `Region`: a named part of a screen, such as header, ranking list, CTA, popup body, bottom tab.
- `Interaction`: click, scroll, input, navigation, open modal, close modal, show toast.

That lets a later LLM request like "replace the popup body" resolve to a specific `screenId`, `state`, and `region` instead of guessing from pixels.

## Preview Strategy

The intended production loop is:

1. User enters a command in the web app.
2. Backend retrieves the relevant screen metadata and image references.
3. LLM generates React or HTML/CSS/JS prototype code.
4. A sandbox builds and smoke-tests the prototype with Playwright.
5. The system publishes a versioned preview URL, such as `/p/:prototypeId`.

This local MVP implements the same shape in the browser with deterministic mock generation. It is ready to swap the mock generator for a real LLM-backed code generation API.

## Idea Variation Mode

A second important workflow is divergent ideation. Instead of producing one prototype from one command, the tool can generate several distinct UI treatments for the same idea.

The current MVP includes four deterministic variation lenses:

- `문장`: lowest-risk copy-first treatment.
- `CHIP`: scannable reason chips.
- `FLOW`: higher-density narrative or decision sequence.
- `4안`: an intentionally reduced version that keeps only the essential content and CTA.

In production, this should become a promptable strategy set. The user gives an idea, a target screen, and optionally a comparison axis such as information density, interruption level, trust, conversion, speed, or learnability. The system returns multiple clickable variants, saves each as a separate prototype version, and lets the user test or combine them.
