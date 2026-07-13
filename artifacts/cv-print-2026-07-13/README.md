# CV Print Pass - 2026-07-13

## Goal

Tighten `/cv/` for browser print/PDF after the experience bullet conversion.

## Result

- Before: `cv-before.pdf`, 5 A4 pages.
- After: `cv-after.pdf`, 2 A4 pages.
- Print-only credential links are hidden because `View credential` is not useful without visible URLs.
- Screen CV layout remains unchanged outside print media.

## Evidence

- `npm run build` passed using the local Hugo fallback binary.
- `npm run check` passed.
- `npm run visual:capture` passed and captured 12 screenshots in `artifacts/visual-smoke/2026-07-13/`.
- `pdfinfo artifacts/cv-print-2026-07-13/cv-after.pdf` reports `Pages: 2`.

## Files

- `cv-before.pdf`
- `cv-print-before.png`
- `cv-after.pdf`
- `cv-print-after.png`
- `cv-after-page-1.png`
- `cv-after-page-2.png`
