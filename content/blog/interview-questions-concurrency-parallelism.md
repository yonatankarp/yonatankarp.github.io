---
title: "[Interview Questions] Concurrency vs. Parallelism: Decoding the Simultaneous Illusion"
date: 2023-03-11T00:00:00+01:00
draft: false
type: "blog"
tags:
  - java
  - kotlin
  - concurrency
  - parallelism
  - interview
  - threads
categories:
  - Backend
  - Java
translationKey: "interview-questions-concurrency-parallelism"
images:
  featured_image: "images/blog/covers/interview-questions-concurrency-parallelism.jpg"
---

> TL;DR - What are the differences between concurrent and parallel programming?

One of my most successful posts so far is a detailed explanation of my favorite interview question (see [How does HashMap work in Java?](https://yonatankarp.com/how-does-hashmap-work-in-java) for more details). As a result, I've decided to create a series of posts breaking down more questions. All the questions that will be answered during this series have been used in my current employer's hiring process.

In today's post, we will focus on concurrent and parallel programming. So without further ado, let's start!

## The Difference between Concurrency and Parallelism

While concurrency and parallelism are related, they're definitely not the same. There are many definitions of concurrency and parallelism. My personal favorite one is:

> Parallelism is running things in (well...) parallel, while concurrency is the illusion of running things in parallel.

While this is an inaccurate definition, it gives a good understanding of what it means. Let's explain this with an example. Let's assume that we want to listen to music on Spotify while playing a game on our machine.

If we have 2 CPUs on our machine, we can run our songs on 1 processor while running our game on another processor. An illustration of the execution would look something like this:

![Parallel execution of 2 tasks](/images/blog/hashnode-bcf83b0e-9e60-432d-a571-762149e7fc4e.svg)

As we can see, each processor is busy running an independent task. Now, let's assume that our machine has only 1 CPU. In such a scenario, we will not be able to run both tasks at the same time since we have only 1 physical processor on our machine. The solution to this problem would be to break the 2 tasks into small intervals. Once we do so, we can rotate between the 2 on our CPU. If the intervals are small enough, from the user's view, the tasks would feel as if they run in parallel. In this scenario, our execution would look something like this:

![Concurrent execution of 2 tasks](/images/blog/hashnode-58818e31-edcd-4636-85ed-90eeacaa70e3.svg)

In the above example, our system has only 1 CPU. Yet, running our threads in small intervals allows the user to feel as if they're running at the same time.

## Advanced Concurrency

Now let's assume that our budget for our computer is low. We can afford only a machine that has 1 CPU and a single thread. Would it still be possible to achieve concurrent execution?

While at the beginning this question might sound tricky, it's actually possible to do so. To solve this problem, we can use the [event-loop](https://en.wikipedia.org/wiki/Event_loop) design pattern. The solution would be to run our code on the CPU until it reaches a blocking operation. A blocking operation can be a disk call (e.g. database) or an IO call (e.g. REST API call). When that happens, the event would be passed into a `blocked` queue, and the next task would be executed. After a given timeout, the event would be passed back to the execution queue and processed again.

The following diagram shows a general example of a basic event loop:

![](/images/blog/hashnode-493be316-afe9-4103-b4de-cea4f1c84ddc.svg)

In fact, some languages such as JavaScript and NodeJS have asynchronous execution based on this exact model.

Note that if, for example, your task never reaches a blocking operation, your program would be stuck, and no other execution would happen. For example, running the following code:

```kotlin
while (true) {
    println("I'm still stuck... :(")
}
```


## Conclusion

Concurrency and parallelism are related but distinct concepts. Concurrency is the ability to perform many tasks concurrently or at the same time. Parallelism is the ability to execute many tasks simultaneously using different processors or cores. In other words, parallelism is a special case of concurrency where many tasks are running at the same time. Moreover, concurrency can be achieved with 1 CPU or even a single thread.
