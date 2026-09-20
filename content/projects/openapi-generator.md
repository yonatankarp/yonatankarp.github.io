---
date: 2023-08-01T00:00:00+01:00
title: "openapi-generator (contributor)"
weight: 20
featured: true
description: "Upstream Kotlin Spring generator work for Spring Boot 4, Jackson 3, Retrofit compatibility, and regression coverage across generated server/client code."
projectKind: "Upstream contribution"
group: "contribution"
draft: false
link: "https://github.com/OpenAPITools/openapi-generator"
caseStudy: true
tech: ["Kotlin", "Spring Boot", "OpenAPI"]
years: "2023-2026"
build:
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "GitHub"
        URL: "https://github.com/OpenAPITools/openapi-generator"
---

Added Spring Boot 4 and Jackson 3 support for the Kotlin Spring generator, then followed through on template regressions that surfaced around Retrofit, Jackson converters, and hashmap model generation. The work spans 10 upstream PRs across generator behavior, test fixtures, and compatibility paths.

<!--more-->

## Context

OpenAPI Generator is the kind of dependency that quietly shapes many service teams' build pipelines. A generator bug is not just an inconvenience: it can create compile failures, invalid Spring contracts, or client code that drifts away from the runtime stack a team is actually migrating toward.

The Kotlin Spring generator work focused on that migration edge. Spring Boot 4 and Jackson 3 support needed more than version bumps because generated source, build files, imports, tests, serialization modules, and compatibility templates all have to move together.

## Work shipped

The contribution set covered the main server path first, then followed the regressions that appeared around adjacent generator modes:

- Spring Boot 4 support for the Kotlin Spring generator.
- Jackson 3 compatibility across generated Kotlin/Spring output.
- Template fixes for Retrofit and Jackson converter paths.
- Regression coverage for hashmap model generation and compatibility behavior.
- Fixture updates that make the generator's behavior easier for maintainers to review.

That follow-through matters because generator changes are especially prone to false confidence. A sample can compile while another option combination breaks. The useful work is not only the headline support, but also tightening the generated cases around it.

## Engineering judgment

This was upstream maintenance work inside a large shared tool, so the constraints were different from a greenfield library. The safest path was incremental: make the target stack compile, keep generated output readable, preserve compatibility where possible, and add tests close to the templates that could regress.

The practical challenge is that OpenAPI Generator has many cross-cutting switches. Framework version, serialization library, client/server mode, model shape, and generator language all interact. The contribution work treated those switches as a matrix to protect, not as a single happy-path demo.

## What this demonstrates

- Moving a widely used generator toward new framework/runtime versions without hiding the migration in local patches.
- Reading generated code as product surface, not disposable build output.
- Fixing template behavior where a small text change can affect many downstream repositories.
- Working inside an established open-source review process with tests and fixtures as the durable argument.
- Following through on compatibility bugs after the first feature PR lands.

## Current shape

- Project: [OpenAPITools/openapi-generator](https://github.com/OpenAPITools/openapi-generator)
- Area: Kotlin Spring generator and related Kotlin/JVM templates
- Stack: Kotlin, Spring Boot, Jackson, Retrofit, OpenAPI Generator templates
- Scope: 10 upstream PRs across support work, regression fixes, and fixture coverage
