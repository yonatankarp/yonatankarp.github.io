# Website visual audit - 2026-08-08

Timezone: Europe/Berlin
Base URL checked: http://127.0.0.1:1313/

## Verdict

The redesigned site is in deployable shape. The build/check suite passed, the route screenshot capture passed across desktop and mobile, and manual screenshot review did not show blocking layout, overflow, image, or navigation defects.

## Concrete findings

- Home page: desktop and mobile render the main staff-engineering positioning clearly, with visible proof, about, experience, selected work, writing, testimonials, and contact sections.
- Projects page: mobile cards preserve thumbnail aspect ratios, labels, tags, and CTA buttons without horizontal overflow.
- Blog page: mobile index keeps the latest article prominent and older post cards readable; image loading and tag layout are stable.
- CV and long-form post routes are covered by the automated visual smoke capture and retained as screenshots for regression comparison.
- Madeira standalone route still passes its richer assertions for route cards, daily itinerary sections, photos, and source panels.

## Follow-up

The next useful website task is content-level rather than layout-level: review the homepage copy for current job-search positioning and decide whether the contact CTA should stay email-first or point to a specific booking/recruiter path.
