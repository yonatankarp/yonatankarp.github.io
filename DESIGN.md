# Design

## Visual theme
A dark editorial-technical portfolio with a photographic Berlin first viewport, near-black cool surfaces, coral as the single active accent, and dense staff-engineer positioning built around clarity, leverage, and reusable systems.

## Color palette
- Background: `oklch(0.145 0.012 280)`
- Surface: `oklch(0.2 0.012 280 / 0.86)`
- Strong surface: `oklch(0.225 0.012 280)`
- Muted surface: `oklch(0.175 0.012 280)`
- Text: `oklch(0.95 0.005 280)`
- Muted text: `oklch(0.74 0.014 280)`
- Accent: `oklch(0.7 0.18 30)`
- Accent strong: `oklch(0.78 0.16 33)`
- Warm accent support: `oklch(0.8 0.13 65)`
- Border: `oklch(0.3 0.012 280)`

## Typography
- Display/body/UI: `Outfit`, then system sans fallbacks
- Code/data: `JetBrains Mono`, then monospace fallbacks
- Large headings use tight tracking and compact leading; body text keeps generous line height and readable line lengths.
- Hebrew content falls back to system UI and `Noto Sans Hebrew`.

## Layout
- Wide but breathable shell, around 1240px max width, with the homepage hero allowed to expand to roughly 1460px.
- Homepage first viewport uses a full-bleed Berlin photo behind an asymmetric hero and multiplier panel.
- Long-form sections using rhythm instead of repeated cards
- Experience and projects presented as editorial lists with strong scan lines
- Blog index split into a featured story, recent articles, and tag navigation

## Components
- Sticky glass navigation over the dark page
- Fixed-size mobile icon menu button
- Pill buttons with subtle lift and active press states
- Timeline-like experience blocks
- Project rows with metadata and outbound CTA
- Inline chips for tags
- Pull-quote testimonials with portrait and attribution
- Contact band with direct email emphasis and fit criteria

## Motion
- Short reveal-on-scroll and section fade-up only when motion is allowed
- Link, button, chip, and navigation transitions should stay short and transform/opacity based
- No decorative bounce, parallax, or oversized cursor tricks

## Accessibility and SEO
- Keep the skip link, visible focus rings, semantic landmarks, canonical link, Open Graph/Twitter metadata, favicon, and JSON-LD schema in place.
- External imagery must keep meaningful alt text when it conveys content.
- Preserve the bundled Hugo build fallback so the site works without a system `hugo` binary.
