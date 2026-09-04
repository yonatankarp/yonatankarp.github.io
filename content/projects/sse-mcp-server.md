---
date: 2026-01-01T00:00:00+01:00
title: "sse-mcp-server"
weight: 40
description: "A Spring Boot Kotlin MCP bridge that exposes typed tools over Server-Sent Events for Flowise-style agent workflows."
group: "project"
projectKind: "AI-agent infrastructure"
caseStudy: true
draft: false
link: "https://github.com/yonatankarp/sse-mcp-server"
tech: ["Kotlin", "Spring Boot", "MCP", "SSE", "Docker"]
years: "2025"
build:
  list: local
params:
    button:
        icon: "icon-arrow-right"
        btnText: "GitHub"
        URL: "https://github.com/yonatankarp/sse-mcp-server"
---

Spring Boot Kotlin MCP bridge for exposing backend tools to Flowise-style agents over Server-Sent Events. It makes tool execution inspectable: the transport is explicit, tools are registered through provider interfaces, and the agent connects through a concrete SSE endpoint instead of a hidden adapter layer.

<!--more-->

## The problem

Agent builders often reach for a visual workflow surface before they have a clean boundary for tools. Flowise and LangChain-compatible runtimes can call external tools, but the useful production question is less glamorous: where does the tool contract live, how is it discovered, and how do you keep the bridge understandable when the agent stops being a demo?

`sse-mcp-server` was built as a small answer to that boundary problem. It exposes an MCP-style server over SSE so an agent can discover and call backend capabilities without coupling every tool directly to the workflow canvas.

## Architecture

The server is a Spring Boot Kotlin application with a configurable MCP server surface. The public contract centers on:

- an SSE endpoint for agent connectivity
- a message endpoint for tool execution
- a manifest endpoint for automatic tool discovery
- provider-based tool registration so capabilities can be added without reshaping the transport
- Docker Compose support for local Flowise-oriented runs

The initial tool set is deliberately simple: arithmetic and date/time operations. That keeps the example focused on the integration boundary rather than pretending the sample tools are the product.

## Trade-offs

This project favors a small, inspectable bridge over a broad agent platform. It is useful when the problem is "connect this agent runtime to controlled backend capabilities" rather than "invent a full orchestration framework."

SSE is also a pragmatic choice. It is easy to reason about from a browser-era stack, works cleanly with long-lived agent connections, and keeps local debugging straightforward. The trade-off is that richer bidirectional interaction still belongs either in explicit message endpoints or a different transport.

## What this demonstrates

- connecting AI-agent workflows to typed backend tools without hiding the execution boundary
- using Kotlin and Spring Boot for a small, configurable infrastructure service
- separating tool registration from transport mechanics
- keeping local agent development reproducible with Docker Compose
- treating MCP integration as backend contract design, not only prompt wiring

## Current shape

- Repository: [github.com/yonatankarp/sse-mcp-server](https://github.com/yonatankarp/sse-mcp-server)
- Stack: Kotlin, Spring Boot, Server-Sent Events, MCP-style tool discovery, Docker Compose
- Built-in example tools: math and date/time providers
