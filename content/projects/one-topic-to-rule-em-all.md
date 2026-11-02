---
date: 2026-06-05T00:00:00+01:00
title: "one-topic-to-rule-em-all"
weight: 56
group: "library"
projectKind: "Talk demo"
draft: false
link: "https://github.com/yonatankarp/one-topic-to-rule-em-all"
tech: ["Kotlin", "Kafka", "Avro"]
years: "2026"
build:
  render: never
  list: local
params:
    button:
        btnText: "GitHub"
---

The running demo for my Kotlin User Group Berlin talk "One Topic to Rule 'Em All": one topic per event type loses the order of an aggregate's events, and one topic per aggregate, keyed by its id and carrying several Avro schemas, keeps it.
