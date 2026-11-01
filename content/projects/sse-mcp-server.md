---
date: 2026-01-01T00:00:00+01:00
title: "sse-mcp-server"
weight: 40
description: "A Spring Boot Kotlin MCP bridge that exposes typed tools over Server-Sent Events for Flowise-style agent workflows."
group: "library"
projectKind: "AI-agent infrastructure"
caseStudy: true
draft: false
link: "https://github.com/yonatankarp/sse-mcp-server"
tech: ["Kotlin", "Spring Boot", "MCP", "SSE", "Docker"]
years: "2025"
params:
    button:
        btnText: "GitHub"
---

Spring Boot Kotlin MCP bridge for exposing backend tools to Flowise-style agents over Server-Sent Events. The transport is explicit, tools are registered through provider interfaces, and the agent connects through a concrete SSE endpoint.

<!--more-->

## The problem

Agent builders often reach for a visual workflow surface before they have a clean boundary for tools. Flowise and LangChain-compatible runtimes can call external tools, which leaves three questions open: where the tool contract lives, how it is discovered, and how the bridge stays understandable as the agent grows.

`sse-mcp-server` is a small answer to that. It exposes an MCP-style server over SSE so an agent can discover and call backend capabilities without coupling every tool directly to the workflow canvas.

## Architecture

The server is a Spring Boot Kotlin application with a configurable MCP server surface. The public contract is:

- an SSE endpoint for agent connectivity
- a message endpoint for tool execution
- a manifest endpoint for automatic tool discovery
- provider-based tool registration so capabilities can be added without reshaping the transport
- Docker Compose support for local Flowise-oriented runs

The initial tools are arithmetic and date/time operations, which keeps the example focused on the integration boundary.

## Trade-offs

This is a small, inspectable bridge with no orchestration of its own. It fits when the problem is connecting an agent runtime to controlled backend capabilities.

I chose SSE because it is easy to reason about from a browser-era stack, works cleanly with long-lived agent connections, and keeps local debugging straightforward. Richer bidirectional interaction has to go through explicit message endpoints or a different transport.

## Current shape

- Repository: [github.com/yonatankarp/sse-mcp-server](https://github.com/yonatankarp/sse-mcp-server)
- Stack: Kotlin, Spring Boot, Server-Sent Events, MCP-style tool discovery, Docker Compose
- Built-in example tools: math and date/time providers
