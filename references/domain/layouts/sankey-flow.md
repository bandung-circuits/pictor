# sankey-flow

Flow diagram where ribbon-like bands connect source nodes to destination nodes, with band width proportional to the quantity flowing between them. Supports multi-stage branching (one source splitting to many destinations) and merging (many sources converging to one destination).

## Structure

- Nodes arranged in vertical columns at each stage (left to right)
- Node height proportional to total flow through that node
- Ribbon connectors between nodes, width encoding flow quantity
- Conservation: total inflow = total outflow at each node
- 2–4 stages typical, with the source stage on the left and the destination stage on the right

## Best For

- Resource allocation and distribution (budgets, aid, spending)
- Value chain analysis (where value is captured at each stage)
- Trade flows between countries or regions
- Energy production-to-consumption pathways
- Population or workforce transitions (job changes, migration)
- Revenue/cost breakdowns across multiple categories

## Critical Visual Rules

1. **Band width = quantity**: This is the defining feature. Every ribbon's width must be visually proportional to its numeric value. Wider bands = larger flows
2. **Conservation principle**: The sum of all destination values MUST exactly equal the source total. Check the arithmetic: add up all destination numbers and verify they match the source. If a source shows 85 million, the destinations must sum to exactly 85 million — no more, no less. Every numeric label on ribbons and nodes must be internally consistent
3. **No crossing optimization**: Where possible, minimize ribbon crossings for readability (some crossings are inevitable with complex data)
4. **Color coding**: Each source node or flow category gets a distinct color. Ribbons carry their source color (with reduced opacity) so viewers can trace flows across stages
5. **Node labels + values**: Every node must show its name and total value. Ribbons may optionally show individual flow values

## Visual Elements

- Rectangular node blocks at each stage column, height proportional to total flow
- Smooth curved ribbons (not straight lines) connecting nodes across stages
- Semi-transparent ribbon fills so overlapping bands remain distinguishable
- Clear whitespace between nodes within the same stage column
- Stage labels at the top of each column ("Source", "Transit", "Destination" or domain-specific names)

## Variants

| Variant | Description | When to Use |
|---------|-------------|-------------|
| **Divergent** | One or few sources splitting into many destinations | Budget allocation, resource distribution |
| **Convergent** | Many sources merging into one or few destinations | Revenue aggregation, supply consolidation |
| **Multi-stage** | 3+ columns with both splitting and merging | Supply chains, value chains, multi-hop transitions |

## Text Placement

- Title at top, large and prominent
- Stage column labels above each column of nodes
- Node names beside or inside each node block
- Numeric values beside nodes (total) and optionally on ribbons (individual flows)
- Legend only if color categories are not self-evident from node labels
- Optional: summary annotation at bottom highlighting the key insight (e.g., "X captures 74% of total flow")

## Recommended Pairings

- `technical-schematic`: Policy analysis and economic flow diagrams
- `clean-analytics`: Data-driven distribution analysis
- `tricon-infographic`: Publication-ready flow analysis
- `corporate-memphis`: Business resource allocation

## Skeleton

```
axis: 1, horizontal, semantic=flow-direction (left-to-right across stages)
slots:
  - source-node:
      role: flow origin
      position: leftmost stage column
      weight: proportional to total outflow
      required: true (at least 1)
  - intermediate-node:
      role: transit/transform point
      position: middle stage column(s)
      weight: proportional to total throughflow
      required: false (0 for 2-stage, 1+ for multi-stage)
  - destination-node:
      role: flow terminus
      position: rightmost stage column
      weight: proportional to total inflow
      required: true (at least 1)
  Note: node HEIGHT encodes quantity — this is unique among all layouts
connectors:
  - ribbon:
      type: curved band (not line)
      width: proportional to flow quantity (the defining feature)
      fill: semi-transparent, colored by source node
      directed: yes (left to right)
      label: optional numeric value
  Note: connectors carry quantitative data through their visual width
anchor: stage columns — vertical alignment guides grouping nodes by stage
stack: vertical sequence stack within each stage column, nodes ordered by size (largest at top)
branch: multi-directional — supports both divergence (split) and convergence (merge)
  This distinguishes sankey-flow from funnel (convergence only) and tree-branching (divergence only)
constraint: conservation — total ribbon width entering a node = total ribbon width leaving it
capacity: 3-12 source nodes, 3-12 destination nodes, 2-4 stages optimal
```
