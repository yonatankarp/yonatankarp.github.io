---
date: 2023-08-01T00:00:00+01:00
title: "openapi-generator (contributor)"
weight: 20
description: "Upstream Kotlin generator work for Spring Boot 4, Jackson 3, Retrofit compatibility, and regression coverage across generated server/client code."
projectKind: "Upstream contribution"
group: "contribution"
draft: false
link: "https://github.com/OpenAPITools/openapi-generator"
caseStudy: true
tech: ["Kotlin", "Spring Boot", "OpenAPI"]
years: "2023-2026"
params:
    button:
        btnText: "GitHub"
---

I fixed Retrofit and Jackson converter templates and hashmap model generation in the Kotlin generators. Later I added Spring Boot 4 and Jackson 3 support to the Kotlin Spring generator, followed by a fix for its Jackson 3 imports. The work covers generator behavior, test fixtures, and compatibility paths.

<!--more-->

## Context

Many service teams run OpenAPI Generator in their build pipelines. A generator bug can create compile failures, invalid Spring contracts, or client code that drifts away from the runtime stack a team is migrating to.

Spring Boot 4 and Jackson 3 support needed more than version bumps, because generated source, build files, imports, tests, serialization modules, and compatibility templates all have to move together.

## Work shipped

- Template fixes for Retrofit and Jackson converter paths.
- A fix and regression coverage for hashmap model generation.
- Spring Boot 4 support for the Kotlin Spring generator.
- Jackson 3 compatibility across generated Kotlin/Spring output, including a follow-up fix for the annotation package in model imports.
- Fixture updates that make the generator's behavior easier for maintainers to review.

A sample can compile while another option combination breaks, so the work also tightened the generated cases around the new support.

## Constraints

This was maintenance inside a large shared tool, where a small template change can affect many downstream repositories. I worked incrementally: make the target stack compile, keep generated output readable, preserve compatibility where possible, and add tests close to the templates that could regress.

OpenAPI Generator has many cross-cutting switches. Framework version, serialization library, client/server mode, model shape, and generator language all interact, so I treated them as a matrix to protect.

## Current shape

- Project: [OpenAPITools/openapi-generator](https://github.com/OpenAPITools/openapi-generator)
- Area: Kotlin Spring generator and related Kotlin/JVM templates
- Stack: Kotlin, Spring Boot, Jackson, Retrofit, OpenAPI Generator templates
- PRs: [#14239](https://github.com/OpenAPITools/openapi-generator/pull/14239), [#17418](https://github.com/OpenAPITools/openapi-generator/pull/17418), [#17673](https://github.com/OpenAPITools/openapi-generator/pull/17673), [#22029](https://github.com/OpenAPITools/openapi-generator/pull/22029), [#23154](https://github.com/OpenAPITools/openapi-generator/pull/23154), [#23406](https://github.com/OpenAPITools/openapi-generator/pull/23406)
