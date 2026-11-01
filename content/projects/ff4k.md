---
date: 2025-12-01T00:00:00+01:00
title: "ff4k"
weight: 10
description: "A Kotlin Multiplatform feature flag library, started after my ff4j Jakarta migration work, with typed properties and a coroutine-first API."
projectKind: "Open source library"
group: "project"
draft: false
link: "https://yonatankarp.github.io/ff4k/"
caseStudy: true
tech: ["Kotlin", "Multiplatform", "Coroutines"]
years: "2026–present"
params:
    button:
        btnText: "Docs"
---

A Kotlin Multiplatform port of the ideas behind ff4j: feature flags, flipping strategies, and typed properties behind a small, coroutine-first API.

<!--more-->

## The problem

`ff4k` came out of my work on [ff4j's Jakarta migration](/projects/ff4j/). `ff4j` has the right product shape for feature flags, but its Java API did not fit cleanly into Kotlin-first services. ff4j 3.0.0, published on September 30, 2026, now ships that migration.

I wrote a port of ff4j's ideas instead of a wrapper, and did not copy its older API shape. `ff4k` treats Kotlin as the native interface: typed properties, pluggable stores, suspend functions, and documentation that lets a service team adopt it without reverse-engineering the library.

Feature flags often start as harmless release switches, then become part of entitlement checks, rollout policy, tenant isolation, and incident response. At that point the library has to make three things boring: where flag definitions live, how state is stored, and which request context influences a decision.

## Design goals

`ff4k` is built around these constraints:

- definitions should be readable in code review
- property values should carry their type
- storage adapters should be explicit, with no magic global state
- targeting context should survive async and coroutine paths
- tests should be able to run without a production store

A backend team can start with in-memory flags for local development, then move the same definitions to a relational store when the rollout needs to survive restarts or be shared between services.

## Architecture

The public API is one `FF4k` entry point, plain data classes, and suspend functions. Features and properties can be declared in code or loaded from JSON. That keeps flag definitions close to the code that owns them, and a service that needs persistence can back them with a store.

Storage is split by operational need:

- in-memory stores for local development and tests
- a JDBC store for JVM services with existing PostgreSQL or MySQL databases
- SQLite support for smaller deployments and embedded cases

A custom store implements `FeatureStore` and `PropertyStore`, and `ff4k-contract-test` verifies it.

Feature targeting often depends on request, tenant, account, or role context. In Kotlin services that data can cross async boundaries, so a check takes its context as an argument and does not rely on thread-local state, which breaks under coroutine scheduling.

## Trade-offs

The library favors integration in application code over a heavy control plane. Feature decisions stay visible in source and tests, and `ff4k` is not a hosted experimentation platform.

Kotlin Multiplatform pushes platform-specific storage and runtime details behind interfaces, while the core model stays portable. The cost is documentation: users need to understand which capabilities are common and which are adapter-specific.

## Current shape

- Docs: [yonatankarp.github.io/ff4k/](https://yonatankarp.github.io/ff4k/)
- Repository: [github.com/yonatankarp/ff4k](https://github.com/yonatankarp/ff4k)
- Status: alpha, pre-1.0, with the JVM target shipping today
- License: Apache-2.0
- Stack: Kotlin Multiplatform, JVM 17, kotlinx.serialization, JDBC and SQLite storage adapters
