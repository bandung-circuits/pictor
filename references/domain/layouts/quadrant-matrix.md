# quadrant-matrix

Two-axis classification where perpendicular dimensions divide the space into four semantically distinct regions, each representing a unique combination of the two dimensions.

## Structure

- Two perpendicular axes crossing at center, each representing an independent dimension
- Four quadrants created by the intersection, each with a distinct composite meaning
- Items placed within quadrants based on their position along both dimensions
- Axes labeled with bipolar endpoints (e.g., High/Low, Strong/Weak)
- Each quadrant named with a descriptive label capturing its composite character

## Best For

- Strategic positioning (BCG matrix, Gartner Magic Quadrant)
- Priority/decision matrices (urgent vs. important)
- Stakeholder mapping (power vs. interest)
- Political/ideological spectrum analysis
- Risk assessment (probability vs. impact)
- Competitive landscape analysis
- Personality/behavioral typologies

## Critical Visual Rules

1. **Two independent axes**: Both axes must represent genuinely independent, continuous dimensions. If the two dimensions are correlated or redundant, a quadrant is the wrong layout
2. **Cross-hair at center**: The perpendicular intersection must be visually prominent — it is the anchor of the entire diagram. The cross-hair divides the canvas into four equal regions
3. **Quadrant naming**: Every quadrant must have a distinct label or character description. These names ARE the analytical insight (e.g., "Stars", "Cash Cows", "Question Marks", "Dogs")
4. **Position must reflect numeric values**: If items have numeric data for each axis, their positions MUST accurately reflect the relative magnitudes. Items with higher values must be placed further from the origin on that axis. Items with equal values on one axis must be at the same height or horizontal position. Do NOT approximate — get the relative ordering and spacing right
5. **Visual differentiation**: Each quadrant should have a distinct background color or shading to make the four regions immediately distinguishable

## Visual Elements

- Bold cross-hair lines dividing the canvas into four regions
- Axis endpoint labels at all four extremities
- Distinct background color/shade per quadrant (subtle, not overpowering)
- Quadrant name/label prominently placed within or above each region
- Items as labeled dots, icons, or cards positioned within their quadrant
- Optional: size encoding (bubble size) for a third variable

## Variants

| Variant | Description | When to Use |
|---------|-------------|-------------|
| **Strategic** | Named quadrants with items as positioned dots/bubbles | BCG matrix, Gartner quadrant, competitive analysis |
| **Decision** | Named quadrants as action categories, items listed within | Eisenhower matrix, priority sorting, risk matrix |
| **Spectrum** | Continuous positioning without hard quadrant boundaries | Political compass, personality mapping |

## Text Placement

- Title at top, large and prominent
- Axis labels at both endpoints of each axis (four labels total)
- Quadrant names centered within each region or at inner corners
- Item labels beside their positioned dots/icons
- Optional: brief description under each quadrant name explaining its meaning
- Optional: summary annotation highlighting key insight (e.g., "Most items cluster in the high-risk/low-reward quadrant")

## Recommended Pairings

- `corporate-memphis`: Business strategy matrices
- `clean-analytics`: Data-driven positioning analysis
- `technical-schematic`: Research and policy evaluation
- `tricon-infographic`: Publication-ready analytical frameworks
- `ui-wireframe`: Decision frameworks and priority sorting

## Skeleton

```
axis: 2, perpendicular, semantic=independent-dimensions
  axis-x: horizontal, bipolar (e.g., low→high)
  axis-y: vertical, bipolar (e.g., weak→strong)
  intersection: center cross-hair (the defining visual anchor)
slots:
  - quadrant-region:
      role: composite classification zone
      count: 4 (top-left, top-right, bottom-left, bottom-right)
      each has: name, description, distinct visual treatment
      contains: 0-N positioned items
      required: true (all 4 must be labeled)
  - item:
      role: classified entity
      position: continuous within quadrant (not snapped to grid)
      weight: optional size encoding for third variable
      required: true (at least 3 items total for the layout to be meaningful)
  Note: items are placed in REGIONS, not fixed slots — position is continuous, not discrete
connectors: none
  Note: items are independent — classified by spatial position, not linked by relationships
anchor: cross-hair intersection — the perpendicular crossing of two axes
  This is unique among all layouts: the anchor IS the classification system
stack: free placement within each quadrant region (items may cluster or spread)
branch: none — no hierarchical or directional relationships
constraint: independence — the two axes must represent genuinely independent dimensions
capacity: 4 quadrants, 3-20 items distributed across them, 2 axis dimensions
```
