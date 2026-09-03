---
date: 2025-12-01T00:00:00+01:00
title: "ff4k"
weight: 10
description: "A Kotlin Multiplatform feature flag library built to replace a stalled Java-era dependency with typed APIs, async storage, and coroutine-aware targeting."
featured: true
projectKind: "Open source library"
group: "project"
draft: false
link: "https://yonatankarp.github.io/ff4k/"
caseStudy: true
tech: ["Kotlin", "Multiplatform", "Coroutines"]
years: "2025–present"
build:
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "Docs"
        URL: "https://yonatankarp.github.io/ff4k/"
---

Kotlin Multiplatform feature flags library built after an upstream ff4j Jakarta migration stalled before release. It turns feature decisions into typed, coroutine-aware application code instead of stringly configured checks hidden behind Java-era runtime assumptions.

<!--more-->

## The problem

`ff4k` started as the pragmatic answer to an upstream dependency problem. `ff4j` had the right product shape for feature flags, but the Jakarta migration was stalled before release, and the existing Java API did not fit cleanly into Kotlin-first services.

The useful path was not a thin wrapper. The replacement needed to treat Kotlin as the native interface: typed configuration, predictable stores, coroutine context propagation, and documentation that lets a service team adopt it without reverse-engineering the library.

The deeper issue was operational clarity. Feature flags often start as harmless release switches, then become part of entitlement checks, rollout policy, tenant isolation, and incident response. At that point the library has to make three things boring: where flag definitions live, how state is stored, and which request context influences a decision.

## Design goals

`ff4k` is shaped around a few constraints that matter in real services:

- definitions should be readable in code review
- flag checks should carry enough type information to fail early
- storage adapters should be explicit rather than magic global state
- async and coroutine paths should preserve targeting context
- tests should be able to run without a production store

Those constraints keep the library small in concept even when the deployment surface grows. A backend team can start with in-memory flags for local development, then move the same definitions behind relational persistence when the rollout process needs to survive restarts or be shared between services.

## Architecture

The public API is centered on a Kotlin DSL for declaring features and properties. That keeps flag definitions close to the code that owns them, while still supporting storage-backed runtime decisions when a service needs persistence.

Storage is deliberately split across operational needs:

- in-memory stores for local development and tests
- JDBC and R2DBC paths for JVM services with existing relational databases
- SQLite support for smaller deployments and embedded cases

The coroutine-aware context model is the important engineering boundary. Feature targeting often depends on request, tenant, account, or role context. In Kotlin services, that data can cross async boundaries, so `ff4k` keeps decisions explicit instead of relying on thread-local assumptions that break under coroutine scheduling.

## Trade-offs

The library intentionally favors typed application integration over a heavy control plane. That is the right bias for teams that want feature decisions to be visible in source and tests, but it means `ff4k` is not trying to be a full hosted experimentation platform.

Kotlin Multiplatform also forces cleaner boundaries. Platform-specific storage and runtime details have to live behind interfaces, while the core model stays portable. That makes the project more disciplined, but it also raises the bar for documentation because users need to understand which capabilities are common and which are adapter-specific.

## What this demonstrates

This project is less about feature flags as a checklist item and more about migration judgment:

- recognizing when an upstream contribution solves the wrong release-time problem
- replacing a stalled dependency without copying its older API shape
- designing for coroutine reality instead of assuming request-local thread affinity
- keeping persistence pluggable without hiding operational behavior
- documenting a library as a product surface, not just a package

## Current shape

- Docs: [yonatankarp.github.io/ff4k/](https://yonatankarp.github.io/ff4k/)
- Repository: [github.com/yonatankarp/ff4k](https://github.com/yonatankarp/ff4k)
- License: Apache-2.0
- Stack: Kotlin Multiplatform, JVM 17, kotlinx.serialization, JDBC/R2DBC/SQLite storage adapters

## Why it matters

This is the kind of infrastructure project that makes a portfolio page more useful than a list of links. The interesting part is the judgment around boundaries: replacing a stalled upstream dependency, keeping the API Kotlin-native, and designing the store/context model so feature decisions remain understandable under production concurrency.

For a hiring or collaboration reader, the signal is not just "I built a library." The signal is that the library came from a concrete dependency failure, narrowed the problem to the parts that mattered, and made the runtime behavior easier to reason about in Kotlin services.
