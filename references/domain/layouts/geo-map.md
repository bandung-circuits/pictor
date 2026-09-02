# geo-map

Geographic map layout where element positions are determined by real-world spatial relationships — countries, regions, cities, and corridors placed according to their actual geographic locations.

## Structure

- Geographic outline (country border, coastline, continent shape) as the primary visual frame
- Region zones: color-coded areas following geographic boundaries (provinces, economic zones, development areas)
- Point markers: cities, projects, or landmarks placed at their geographic coordinates
- Route corridors: curved lines following geographic paths (economic belts, trade routes, rivers)
- Information layers stacked on the same geographic coordinate space (outline → regions → routes → points → labels)

## Best For

- Regional development strategies and policy layouts
- Trade routes, economic corridors, Belt and Road initiatives
- Geopolitical analysis and sphere-of-influence mapping
- Resource distribution and infrastructure networks
- Multi-region comparative analysis with spatial context

## Visual Elements

- Recognizable geographic outline — viewers must immediately identify the territory (e.g., China, Africa, Southeast Asia)
- Color-coded regions with semi-transparent fills (so underlying geography remains visible)
- Small isometric illustrations or icons at key locations (cities as skylines, projects as buildings)
- Curved connector lines following real geographic paths (not straight lines)
- Proportional scale — not GIS-precise, but relative positions and sizes must feel correct

## Text Placement

- Title at top, large and prominent
- Subtitle or summary below title
- Region labels positioned near their geographic center
- Point labels with callout lines connecting to their markers
- Legend box (REQUIRED) — maps encode multiple dimensions simultaneously (color = category, icon = type, line style = connection type)
- Optional: brief annotation paragraph at bottom summarizing the geographic pattern

## Recommended Pairings

- `technical-schematic`: Policy analysis and strategic planning maps
- `tricon-infographic`: Publication-ready geographic analysis
- `bold-graphic`: High-impact geopolitical maps
- `clean-analytics`: Data-driven regional analysis

## Skeleton

```
axis: 2, semantic=geographic-coordinates (east-west / north-south)
  Unlike all other layouts, axis semantics come from the physical world, not information logic.
anchor:
  - primary: geographic outline (country border, coastline) — defines recognizability
  - secondary: geographic features (rivers, mountain ranges) — provide spatial reference
slots:
  - region:
      role: area-level information carrier
      position: determined by geographic boundaries (irregular shapes)
      weight: primary or secondary (by information importance, not area size)
      visual: color-coded fill, semi-transparent
      required: true (at least 1)
  - point:
      role: location-specific marker
      position: fixed to geographic coordinates
      weight: secondary
      visual: icon, marker, or small illustration
      required: false
connectors:
  - corridor: curved lines following geographic paths (economic belts, trade routes)
  - flow-arrow: directional movement between locations (migration, trade, resources)
  Note: connectors follow geographic contours, not straight lines
stack: layer-stack (z-order) — the core organizing principle
  - layer 1 (bottom): geographic outline
  - layer 2: region color fills
  - layer 3: route corridors and connectors
  - layer 4: point markers and icons
  - layer 5 (top): labels, callouts, legend
branch: not applicable
annotation:
  - legend: REQUIRED (maps encode position + category + intensity simultaneously)
  - labels: location names near geographic coordinates
  - callouts: detailed descriptions connected to specific locations
capacity: 3-8 regions, 5-15 points optimal
```
