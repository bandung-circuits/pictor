# toulmin-argument

Argument structure showing a claim supported by grounds and warrant, with optional backing, qualifier, and rebuttal — based on the Toulmin model of argumentation.

## Structure

- Claim at top: the conclusion being argued
- Grounds at bottom: facts, data, evidence supporting the claim
- Warrant in the middle: the reasoning that connects grounds to claim
- Backing beside warrant: authority or theory that makes the warrant credible
- Qualifier beside claim: words that limit the claim's scope ("probably", "in most cases")
- Rebuttal opposing the claim: exceptions or counter-arguments

## Best For

- Thesis defense and academic arguments
- Policy justification (claim + evidence + reasoning)
- Persuasive essay structure visualization
- Critical thinking and logic analysis
- Debate preparation and argument mapping

## Arrow Direction (CRITICAL)

All arrows represent **logical support** and MUST point **upward** — from the supporting element toward the element being supported:

- **Grounds → Warrant** (upward): evidence feeds into reasoning. Arrow points UP from Grounds to Warrant. Label: "so"
- **Warrant → Claim** (upward): reasoning supports the conclusion. Arrow points UP from Warrant to Claim. Label: "since"
- **Backing → Warrant** (sideways→inward): authority reinforces the warrant. Arrow points from right toward Warrant. Label: "because"
- **Rebuttal → Claim** (sideways→inward): counter-argument challenges the claim. Arrow points from left toward Claim. Label: "unless"
- **Qualifier → Claim** (sideways→inward): scope modifier annotates the claim. Arrow points from right toward Claim. Label: "probably"

The visual flow is BOTTOM → UP, like a building: evidence at the foundation, claim at the top. **Never draw arrows pointing downward from Claim to Grounds** — that reverses the logic of the argument.

## Visual Elements

- Prominent claim block at top, visually weighty
- Solid upward-pointing arrows from grounds through warrant to claim (the "support chain") — arrows MUST point UP
- Warrant as a bridge or stepping stone between grounds and claim
- Backing attached to warrant from the side, arrow pointing inward toward warrant
- Qualifier as a small tag or badge near the claim
- Rebuttal visually distinct (different color, dashed border) approaching claim from the opposite side
- Clear visual hierarchy: claim largest, grounds second, warrant/backing/qualifier/rebuttal smaller

## Variants

| Variant | Focus | Visual Emphasis |
|---------|-------|-----------------|
| **Simple** | Claim + Grounds + Warrant only | Clean three-tier vertical stack, minimal |
| **Full** | All 6 Toulmin elements | Complete layout with side branches for backing, qualifier, rebuttal |

## Text Placement

- Title at top above the diagram
- Claim text inside the top block
- Grounds text inside the bottom block
- Warrant text in the middle connector region
- Backing label to the side of warrant
- Qualifier label near claim (e.g., upper-right)
- Rebuttal label on the opposing side of claim (e.g., upper-left)
- Arrow labels: "so" (grounds→warrant, upward), "since" (warrant→claim, upward), "because" (backing→warrant, sideways), "unless" (rebuttal→claim, sideways)

## Recommended Pairings

- `technical-schematic`: Rigorous academic argumentation
- `aged-academia`: Classical scholarly arguments
- `chalkboard`: Educational logic exercises
- `bold-graphic`: High-impact persuasive arguments

## Skeleton

```
axis: 1, vertical, semantic=support-direction (bottom-up)
slots:
  - claim:
      role: conclusion
      position: top-center
      weight: primary
      required: true
  - grounds:
      role: evidence-base
      position: bottom-center
      weight: primary
      required: true
  - warrant:
      role: reasoning-bridge
      position: mid-center (on the path from grounds to claim)
      weight: secondary
      required: true
  - backing:
      role: authority-support
      position: mid-right (beside warrant)
      weight: secondary
      required: false
  - qualifier:
      role: scope-limiter
      position: top-right (beside claim)
      weight: secondary
      required: false
  - rebuttal:
      role: counter-argument
      position: top-left (opposing claim)
      weight: secondary
      required: false
connectors:
  - grounds → warrant: directed line, label="so"
  - warrant → claim: directed line, label="since"
  - backing → warrant: directed line, label="because"
  - qualifier → claim: annotation line, label="probably"
  - rebuttal → claim: opposing line, label="unless"
anchor: logical-level divide between grounds zone and claim zone
branch: none (fixed topology, not a branching structure)
capacity: exactly 3 required slots + up to 3 optional slots
```
