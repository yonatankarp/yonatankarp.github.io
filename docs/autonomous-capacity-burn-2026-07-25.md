# Autonomous Capacity Burn - 2026-07-25

Run time: 2026-07-25 11:14:19 CEST

## Scope

Monthly capacity-burn pass focused on website release quality and the open next item from the previous audit: external link drift.

## Delivered

1. Replaced two stale Retrofit links that pointed at `https://square.github.io/retrofit/`, which now returns HTTP 404 during automated validation.
2. Updated the external link checker to skip `www.getyourguide.com` URLs. The Madeira trip page still contains the booking reference, but GetYourGuide returns Cloudflare bot-protection responses to automation, so probing it is not a useful signal for site health.
3. Re-ran the full local website check and the external-link checker; both now pass.

## Commands

```text
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io remote -v
npm run check:links:external
rg -n "square\\.github\\.io/retrofit|getyourguide\\.com/madeira" .
curl -I -L --max-time 15 https://www.getyourguide.com/madeira-l67/
curl -I -L --max-time 15 https://www.getyourguide.com/madeira-l67/madeira-skywalk-porto-moniz-seixal-and-fanal-4wd-tour-t225105/
npm run check
npm run check:links:external
```

## Evidence

- Initial `npm run check:links:external`: failed on `https://square.github.io/retrofit/` with HTTP 404 and on the GetYourGuide tour URL with `fetch failed`.
- `curl` to the GetYourGuide broad Madeira page and exact tour page returned HTTP 403 Cloudflare bot protection, confirming the site is not reliable for automated link probing.
- `npm run check`: passed across blog assets, Hugo build, metadata, generated HTML, CV print, and internal links.
- `npm run check:links:external`: passed across 94 HTML files and 150 external URLs.

## Next

Run a fresh visual capture after the next content or layout change; this pass changed source links and validation behavior only, so screenshots were not recaptured.
