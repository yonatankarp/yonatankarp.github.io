---
title: "Design Patterns - Factory"
date: 2023-10-24T00:00:00+01:00
aliases:
  - /design-patterns-factory
draft: false
type: "blog"
description: "Master the Factory Pattern for efficient code, improved scalability, and simplified object creation in software development."
tags:
  - kotlin
  - design-patterns
  - clean-code
images:
  featured_image: "/images/blog/covers/design-patterns-factory.jpg"
---

> **TL;DR:** Factory pattern provides a static method encapsulated in a class to hide implementation logic, allowing client code to focus on usage rather than object initialization. It simplifies object creation, promotes loose coupling, and supports easy switching between object types without modifying existing code.

<!--more-->

## Also known as

- Factory
- Simple Factory

## Intent

Providing a static method encapsulated in a class called the factory, to hide the implementation logic and make client code focus on usage rather than initializing new objects.

## Explanation

Real-world example

> Imagine an alchemist who is about to manufacture coins. The alchemist must be able to create both gold and copper coins and switching between them must be possible without modifying the existing source code. The factory pattern makes it possible by providing a static construction method which can be called with relevant parameters.

Wikipedia says

> A factory is an object for creating other objects – formally a factory is a function or method that returns objects of a varying prototype or class.

**Programmatic Example**

We have an interface `Coin` and two implementations `GoldCoin` and `CopperCoin`.

```kotlin
internal interface Coin {
    val description: String
}

internal class GoldCoin : Coin {
    override val description = "This is a gold coin."
}

internal class CopperCoin : Coin {
    override val description = "This is a copper coin."
}
```

The enumeration above represents the types of coins that we support (`GoldCoin` and `CopperCoin`).

```kotlin
internal enum class CoinType(val constructor: () -> Coin) {
    COPPER({ CopperCoin() }),
    GOLD({ GoldCoin() }),
}
```

Then we have the static method `getCoin` to create coin objects encapsulated in the factory class `CoinFactory`.

```kotlin
internal object CoinFactory {
    fun getCoin(type: CoinType): Coin = type.constructor()
}
```

Now on the client code, we can create different types of coins using the factory class.

```kotlin
logger.info("The alchemist begins his work.")
val copper = CoinFactory.getCoin(CoinType.COPPER)
val gold = CoinFactory.getCoin(CoinType.GOLD)
logger.info(copper.description)
logger.info(gold.description)
```

Program output:

```shell
The alchemist begins his work.
This is a copper coin.
This is a gold coin.
```

## Class Diagram

![Factory class diagram: CoinFactory creates a GoldCoin or CopperCoin, both implementing Coin, from a CoinType](/images/blog/design-patterns-factory-class-diagram.webp)

## Applicability

Use the factory pattern when you only care about the creation of an object, not how to create and manage it.

Pros

- Allows keeping all objects created in one place.
- Allows to write loosely coupled code. Some of its main advantages include better testability, easy-to-understand code, swappable components, scalability, and isolated features.

Cons

- The code becomes more complicated than it should be.

## Code Examples

All code examples and tests can be found in the [**Kotlin Design Patterns repository**](https://github.com/yonatankarp/kotlin-design-patterns/tree/main/factory)

## Related patterns

- [Factory Method](https://github.com/yonatankarp/kotlin-design-patterns/tree/main/factory-method)
- [Abstract Factory](/blog/design-patterns-abstract-factory/)
- Factory Kit

## Credits

- [Java Design Patterns](https://github.com/iluwatar/java-design-patterns)
- Cover photo by [Alexander Tsang](https://unsplash.com/@alexander_tsang) on [Unsplash](https://unsplash.com/).
