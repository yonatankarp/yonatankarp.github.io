---
date: 2022-10-01T00:00:00+01:00
title: "kotlin-design-patterns"
weight: 50
projectKind: "Technical writing / docs"
group: "library"
draft: false
link: "https://yonatankarp.com/kotlin-design-patterns/"
tech: ["Kotlin", "MkDocs"]
years: "2022–present"
build:
  render: never
  list: local
params:
    button:
        btnText: "Website"
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
