---
title: "How to Break Your HashMap in Less Than a Minute"
date: 2022-12-02T00:00:00+01:00
draft: false
type: "blog"
tags:
  - java
  - kotlin
  - hashmap
  - data-structures
  - gotchas
categories:
  - Backend
  - Java
---

> **TL;DR:** Never use mutable objects as keys in your HashMap!

After I wrote my article [**How does HashMap work in Java?**](https://yonatankarp.com/how-does-hashmap-work-in-java), a few people suggested more topics related to HashMap. As a result, I decided to create a short series of articles about it.

In today's article, we will discuss JVM HashMaps and how they can be easily broken if not used carefully. It's important to note that while we'll be focusing on the JVM world, the same principles apply to most modern programming languages.

In this article, I will provide an implementation using Java and then explain the root cause of the problem. I will also offer solutions to address the issues I introduce.

## The How

Let's consider the following simple class. It encapsulates an integer value within an object and provides methods to get or set the value:

```java
public class IntWrapper {
    private int value;

    public IntWrapper(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }

    public void setValue(int value) {
        this.value = value;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof IntWrapper)) return false;
        return value == ((IntWrapper) other).value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(value);
    }
}
```

Now, let's use our class and add it to a `HashMap`:

```java
Map<IntWrapper, String> map = new HashMap<>();
IntWrapper myInteger = new IntWrapper(1);
map.put(myInteger, "");
myInteger.setValue(2);

if (map.containsKey(myInteger)) {
    System.out.println("Our int was found!");
} else {
    System.out.println("Sorry, nobody is home :(");
}
```

What would be printed here? If your answer was `Sorry, nobody is home :(`, you're correct. But why?

## The Why

The problem lies in using a mutable class as the key in a HashMap and then modifying it afterward. As I mentioned in my previous article, when you add a new key/value pair to a HashMap, the key's hash is calculated, and the pair is stored in the relevant bucket:

![](/images/blog/001-hashmap-insert-object.png)

However, in our case, we changed the value of the class. So when we calculate the hash code of the updated object, it will likely end up in a different bucket. Consequently, when HashMap checks the bucket, it won't find the required object!

![](/images/blog/medium-1*-ehInn6beG7s3ry6JnqOBQ.png)

## Can we avoid this problem?

![](/images/blog/004-avoid-at-all-cost.jpeg)

Yes, we can! To avoid this issue, we should use an immutable class instead of a mutable one. This means that once the class creates its state, it cannot be changed.

Let's start with a simple plain old Java implementation for the class:

```java
public class IntWrapper {
    private final int value;

    public IntWrapper(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof IntWrapper)) return false;
        return value == ((IntWrapper) other).value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(value);
    }
}
```

As you can see in this implementation, the value of the class can only be set via the constructor, ensuring that it won't change later on. By marking the field as `final`, we guarantee that it cannot be changed at runtime, even using [reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html). This makes our class truly immutable.

## Can we do even better?

The code now works correctly. However, it is still quite verbose. Fortunately, starting from Java 14, we have a new language feature (which became official in Java 16) called **Records**.

What are records?

> JDK 14 introduces records, which are a new kind of type declaration. Like an `enum`, a record is a restricted form of a class. It’s ideal for "plain data carriers," classes that contain data not meant to be altered and only the most fundamental methods such as constructors and accessors.

What does that mean? By defining a class as a record, we automatically get the following methods implemented for us:

* A constructor that assigns all inputs to the class members.
    
* Getters for all class members, with associated private final fields.
    
* An automatically generated `toString()` implementation.
    
* `hashCode()` and `equals()` methods.
    

If you want to learn more about records and their usage, you can check [Oracle's official documentation](https://docs.oracle.com/en/java/javase/14/language/records.html).

So let's try it out:

```java
public record IntWrapper(int value) {
}
```

As you can see, our code is much simpler now. If we try to repeat the map change from before, we will get a compilation error:

```java
Map<IntWrapper, String> map = new HashMap<>();
IntWrapper myInteger = new IntWrapper(1);
map.put(myInteger, "I am a nice int value!");
myInteger.setValue(2); // Compilation error!

if (map.containsKey(myInteger)) {
    System.out.println("Our int was found!");
} else {
    System.out.println("Sorry, nobody is home :(");
}
```

If you are using an older version of Java, you can still achieve this functionality with [Project Lombok](https://projectlombok.org/) by using the `@Value` annotation. More details are available [here](https://projectlombok.org/features/Value).


# Conclusion

![](/images/blog/002-hashmap-object-mutation.png)

Whenever you use a HashMap (in Java or any other language), make sure you use immutable objects as keys. Otherwise, it might lead to unexpected behavior in your code during its execution.
