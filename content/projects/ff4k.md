---
date: 2025-12-01T00:00:00+01:00
title: "ff4k"
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

Kotlin Multiplatform feature flags library built after an upstream ff4j Jakarta migration stalled before release. It focuses on typed DSL configuration, JDBC/R2DBC/SQLite storage options, and coroutine-safe context propagation so feature decisions can stay explicit across backend boundaries.

<!--more-->

## Why it exists

`ff4k` started as the pragmatic answer to an upstream dependency problem. `ff4j` had the right product shape for feature flags, but the Jakarta migration was stalled before release, and the existing Java API did not fit cleanly into Kotlin-first services.

The useful path was not a thin wrapper. The replacement needed to treat Kotlin as the native interface: typed configuration, predictable stores, coroutine context propagation, and documentation that lets a service team adopt it without reverse-engineering the library.

## What changed

The public API is centered on a Kotlin DSL for declaring features and properties. That keeps flag definitions close to the code that owns them, while still supporting storage-backed runtime decisions when a service needs persistence.

Storage is deliberately split across operational needs:

- in-memory stores for local development and tests
- JDBC and R2DBC paths for JVM services with existing relational databases
- SQLite support for smaller deployments and embedded cases

The coroutine-aware context model is the important engineering boundary. Feature targeting often depends on request, tenant, account, or role context. In Kotlin services, that data can cross async boundaries, so `ff4k` keeps decisions explicit instead of relying on thread-local assumptions that break under coroutine scheduling.

## Current shape

- Docs: [yonatankarp.github.io/ff4k/](https://yonatankarp.github.io/ff4k/)
- Repository: [github.com/yonatankarp/ff4k](https://github.com/yonatankarp/ff4k)
- License: Apache-2.0
- Stack: Kotlin Multiplatform, JVM 17, kotlinx.serialization, JDBC/R2DBC/SQLite storage adapters

## Why it matters

This is the kind of infrastructure project that makes a portfolio page more useful than a list of links. The interesting part is the judgment around boundaries: replacing a stalled upstream dependency, keeping the API Kotlin-native, and designing the store/context model so feature decisions remain understandable under production concurrency.
