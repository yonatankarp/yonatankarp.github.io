---
date: 2026-05-23T00:00:00+01:00
title: "ktor-template"
weight: 54
group: "library"
projectKind: "Service template"
draft: false
link: "https://github.com/yonatankarp/ktor-template"
tech: ["Kotlin", "Ktor", "Exposed", "PostgreSQL"]
years: "2026"
build:
  render: never
  list: local
params:
    button:
        btnText: "GitHub"
---

A template for starting a Ktor 3 service on JDK 25, split into domain, application and adapter modules so the hexagonal boundaries hold at compile time, with the same CI, Docker, PostgreSQL and observability baseline as kotlin-spring-boot-template.
