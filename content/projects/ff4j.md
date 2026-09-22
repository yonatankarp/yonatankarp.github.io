---
date: 2026-03-15T00:00:00+01:00
title: "ff4j (contributor)"
weight: 40
description: "Upstream Jakarta namespace migration work that exposed the release gap behind the later ff4k replacement."
group: "contribution"
projectKind: "Upstream contribution"
draft: false
link: "https://github.com/ff4j/ff4j"
caseStudy: true
tech: ["Java", "Jakarta"]
years: "2025"
build:
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "GitHub"
        URL: "https://github.com/ff4j/ff4j"
---

Authored ff4j's `javax.*` to `jakarta.*` namespace migration so the Java feature-flag library could fit modern Spring Boot 3 and Jakarta EE 9+ application stacks. The PR merged, but the unreleased migration later became the practical motivation for building `ff4k`.

<!--more-->

## Context

ff4j had the right general shape for Java feature flags, but the ecosystem around it had moved. Spring Boot 3 and Jakarta EE 9+ require the `jakarta.*` namespace, while older Java EE libraries still depended on `javax.*`. That made a small-looking import boundary into a deployment blocker for teams trying to modernize their services.

The upstream contribution was deliberately narrow: migrate the namespace boundary and dependency surface without changing ff4j's product model. It closed the compatibility issue in the project while keeping the work reviewable for maintainers.

## Work shipped

- Replaced legacy `javax.*` imports with Jakarta equivalents.
- Updated the affected dependencies for modern Java enterprise stacks.
- Merged the migration as ff4j PR [#752](https://github.com/ff4j/ff4j/pull/752), closing the reported Jakarta compatibility issue.
- Kept the change focused to 29 files with a balanced import and dependency migration rather than a broader library redesign.

The important product detail is that this was a breaking ecosystem migration. It needed a new major release, not just a patch release, because applications depending on the old Java EE namespace would feel the API/runtime shift.

## Engineering judgment

This contribution sits at the boundary between "fix the dependency" and "replace the dependency." The upstream PR solved the immediate technical compatibility problem, but merge status is not the same thing as availability. If a library does not release the migration, downstream teams still cannot depend on it in production.

That gap is what made `ff4k` a reasonable follow-on instead of a vanity rewrite. The lesson was not simply that ff4j used an old namespace; it was that feature-flag infrastructure needed an actively maintained, Kotlin-native surface with predictable async behavior and storage boundaries.

## What this demonstrates

- Diagnosing dependency modernization work at the framework compatibility layer.
- Keeping upstream changes contribution-sized even when the surrounding problem is larger.
- Recognizing that release cadence is part of dependency risk, not separate from implementation quality.
- Turning a stalled upstream migration into a sharper replacement strategy instead of copying the older API unchanged.

## Current shape

- Project: [ff4j/ff4j](https://github.com/ff4j/ff4j)
- Contribution: [PR #752](https://github.com/ff4j/ff4j/pull/752)
- Area: Java EE to Jakarta namespace migration
- Scope: 29 files, 155 additions, 160 deletions
- Relationship: direct precursor to [ff4k](/projects/ff4k/)
