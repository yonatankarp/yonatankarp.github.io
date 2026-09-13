---
date: 2022-10-01T00:00:00+01:00
title: "kotlin-design-patterns"
weight: 50
featured: true
projectKind: "Technical writing / docs"
group: "project"
draft: false
link: "https://yonatankarp.com/kotlin-design-patterns/"
tech: ["Kotlin", "MkDocs"]
years: "2022–present"
build:
  render: never
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "Website"
        URL: "https://yonatankarp.com/kotlin-design-patterns/"
---

Software design patterns implemented in idiomatic Kotlin. A teaching/reference project that turns familiar object-oriented patterns into Kotlin-first examples with a generated MkDocs documentation site.

<!--more-->

## Why it exists

Most design-pattern references are written for Java or language-agnostic UML examples. That leaves Kotlin developers translating the idea and the syntax at the same time: null-safety, data classes, top-level functions, sealed types, extension functions, and coroutine-aware APIs all change how a pattern should feel in real code.

This project keeps the pattern vocabulary familiar while making the examples readable as Kotlin, not Java with different file extensions.

## Project shape

- Kotlin/JVM examples organized by pattern, with a documentation site generated from the repository.
- Category-level navigation for creational, structural, behavioral, and other design pattern families.
- CI and GitHub Pages workflows keep examples and published docs on the same path.
- Public repository under the MIT license, so examples are reusable in teaching, interviews, and engineering discussions.

## Current signal

The project is still a useful homepage proof point because it is current infrastructure-adjacent writing, not just an old tutorial. As of the September 2026 site review, the upstream repository was public, unarchived, Kotlin-based, and had successful CI and GitHub Pages runs after a September 7, 2026 push.

## What this demonstrates

- Translating a broad technical reference into idiomatic language-specific examples.
- Maintaining docs-as-code with generated static documentation instead of a detached article.
- Turning reusable engineering knowledge into a navigable public artifact.
