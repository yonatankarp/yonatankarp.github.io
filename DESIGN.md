# Design

## Visual theme
A restrained editorial-technical portfolio. Warm off-white surfaces in light mode, ink-toned dark mode, teal as the single active accent, and a balance of serif display typography with disciplined sans-serif UI text.

## Color palette
- Canvas light: `oklch(0.96 0.01 85)`
- Canvas dark: `oklch(0.18 0.01 240)`
- Text light: `oklch(0.22 0.01 85)`
- Text dark: `oklch(0.93 0.01 85)`
- Muted light: `oklch(0.48 0.01 85)`
- Muted dark: `oklch(0.78 0.01 85)`
- Accent: `oklch(0.52 0.09 190)`
- Accent strong: `oklch(0.42 0.08 190)`
- Border light: `oklch(0.87 0.01 85)`
- Border dark: `oklch(0.30 0.01 240)`

## Typography
- Display: `Literata`, then Georgia and serif fallbacks
- Body/UI: `Manrope`, then system sans fallbacks
- Hebrew fallback stack should prefer system fonts with native RTL support
- Tight display tracking, generous body leading, readable line lengths capped near 70ch

## Layout
- Wide but breathable shell, around 1180 to 1240px max width
- Asymmetric hero with portrait and dense introduction
- Long-form sections using rhythm instead of repeated cards
- Experience and projects presented as editorial lists with strong scan lines
- Blog index split into a featured story, recent articles, and tag navigation

## Components
- Sticky top navigation with theme and language controls
- Pill buttons with subtle lift on hover
- Timeline-like experience blocks
- Project rows with metadata and outbound CTA
- Inline chips for tags
- Pull-quote testimonials with portrait and attribution
- Minimal contact panel with direct email emphasis

## Motion
- Short reveal-on-scroll and section fade-up only when motion is allowed
- Theme transitions should be subtle, mostly color and surface changes
- No decorative bounce, parallax, or oversized cursor tricks
