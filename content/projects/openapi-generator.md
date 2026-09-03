---
date: 2023-08-01T00:00:00+01:00
title: "openapi-generator (contributor)"
weight: 20
featured: true
projectKind: "Upstream contribution"
group: "contribution"
draft: false
link: "https://github.com/OpenAPITools/openapi-generator"
tech: ["Kotlin", "Spring Boot", "OpenAPI"]
build:
  render: never
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "GitHub"
        URL: "https://github.com/OpenAPITools/openapi-generator"
---

Added Spring Boot 4 and Jackson 3 support for the Kotlin Spring generator, then followed through on template regressions that surfaced around Retrofit, Jackson converters, and hashmap model generation. The work spans 10 upstream PRs across generator behavior, test fixtures, and compatibility paths.
