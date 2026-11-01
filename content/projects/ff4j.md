---
date: 2026-03-15T00:00:00+01:00
title: "ff4j (contributor)"
weight: 40
description: "Upstream migration of ff4j from the javax to the jakarta namespace. It led me to start ff4k, and ff4j 3.0.0 now ships it."
group: "contribution"
projectKind: "Upstream contribution"
draft: false
link: "https://github.com/ff4j/ff4j"
caseStudy: true
tech: ["Java", "Jakarta"]
years: "2025"
params:
    button:
        btnText: "GitHub"
---

I wrote ff4j's `javax.*` to `jakarta.*` namespace migration so the Java feature-flag library could fit Spring Boot 3 and Jakarta EE 9+ application stacks. The PR merged, and that work is what led me to build `ff4k`. ff4j 3.0.0 now ships the migration.

<!--more-->

## Context

ff4j had the right general shape for Java feature flags, but the ecosystem around it had moved. Spring Boot 3 and Jakarta EE 9+ require the `jakarta.*` namespace, while older Java EE libraries still depended on `javax.*`. That made a small-looking import boundary into a deployment blocker for teams trying to modernize their services.

I kept the contribution narrow: migrate the namespace and the dependencies without changing ff4j's product model, so the maintainers could review it. It closed the compatibility issue in the project.

## Work shipped

- Replaced legacy `javax.*` imports with Jakarta equivalents.
- Updated the affected dependencies for Java enterprise stacks.
- Merged the migration as ff4j PR [#752](https://github.com/ff4j/ff4j/pull/752), closing the reported Jakarta compatibility issue.
- Kept the change to 29 files, with no wider library redesign.

This was a breaking migration. It needed a new major release, because applications depending on the old Java EE namespace would see the API and runtime change. ff4j 3.0.0, published on September 30, 2026, ships it.

## What came next

This work is what triggered [`ff4k`](/projects/ff4k/), a Kotlin-native feature flag library with predictable async behavior and storage boundaries, which does not copy the older API.

## Current shape

- Project: [ff4j/ff4j](https://github.com/ff4j/ff4j)
- Contribution: [PR #752](https://github.com/ff4j/ff4j/pull/752)
- Released in: [ff4j 3.0.0](https://github.com/ff4j/ff4j/releases/tag/3.0.0)
- Area: Java EE to Jakarta namespace migration
- Scope: 29 files, 155 additions, 160 deletions
- Relationship: direct precursor to [ff4k](/projects/ff4k/)
