---
title: "How to Fix Misconfigurations in RedisTemplate"
date: 2024-06-05T00:00:00+01:00
draft: false
type: "blog"
description: "A practical guide to identifying and fixing common RedisTemplate misconfiguration pitfalls in Spring Boot, with a focus on serialization issues."
tags:
  - kotlin
  - spring-boot
  - redis
  - redistemplate
categories:
  - Backend
translationKey: "fix-misconfigurations-redistemplate"
images:
  featured_image: "/images/blog/covers/fix-misconfigurations-redistemplate.jpg"
---



Our story begins with a colleague and me trying to debug an issue with our project for a few hours. We needed to fetch a value from Redis storage, but whenever the service ran, the fetched value was `null`. Despite our efforts, we couldn't find a solution on the internet, and to make matters worse, our code was actually covered by tests that had all passed!

<!--more-->


In this article, we will explore a common issue when using `RedisTemplate` in Spring applications. We'll demonstrate how misconfigurations can lead to your tests passing while failing to fetch the correct data. Additionally, we'll show you how to configure properly `RedisTemplate` to avoid this problem.


## Initial Configuration


To configure our application to connect to Redis, we will add the following configurations to your `application.yml` file:


```
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
```


This configuration sets up the Redis host and port, defaulting to `localhost` and `6379` if no environment variables are provided.


## Creating the RedisTemplate Bean


We will now create our `RedisTemplate` bean to be used as a Redis client in our codebase.


```
@Configuration
class RedisConfiguration {
    @Bean
    fun redisTemplate(connectionFactory: RedisConnectionFactory): RedisTemplate =
        RedisTemplate().apply {
            this.connectionFactory = connectionFactory
        }
}
```


In this code, we define a `RedisTemplate` with a `String` key type and an `Int` value type, associating it with the Redis connection factory.


## Writing Tests


In the next step, we will create a test that uses a Redis test container:


```
@SpringBootTest
@TestConstructor(autowireMode = ALL)
class RedisContainerTest(private val redisTemplate: RedisTemplate) {
    companion object {
        private const val REDIS_PORT = 6379

        private val redisContainer = GenericContainer("redis:latest").apply {
            withExposedPorts(REDIS_PORT)
            start()
        }

        @AfterAll
        @JvmStatic
        fun tearDown() {
            redisContainer.stop()
        }
    }
}
```


We will set our Redis host and port to the values of our test container next:


```
@DynamicPropertySource
@JvmStatic
@Suppress("unused")
fun registerDynamicProperties(registry: DynamicPropertyRegistry) {
   registry.add("spring.data.redis.host") { redisContainer.host }
   registry.add("spring.data.redis.port") { redisContainer.getMappedPort(REDIS_PORT) }
}
```


Next, we will ensure that our Redis cache is truncated between tests, and insert a predefined key and value into Redis using the `redis-cli` tool.


```
@BeforeEach
fun setup() {
   redisTemplate.delete(redisTemplate.keys("*"))
   redisContainer.execInContainer(
       "redis-cli",
       "SET",
       KEY,
       VALUE.toString()
   )
}
```


## Identifying The Issue


By running the following test with a breakpoint and checking the container running the command, we can see that the key is indeed stored in our container.


```
$ docker exec -it  redis-cli
127.0.0.1:6379> keys *
1) "key"
```


Now, we will write two tests. The first will try to fetch the value from the container directly using our `RedisTemplate` bean.


```
@Test
fun `should fail to fetch value`() {
   // Given predefined int key in Redis

   // When we fetch the value
   val value = redisTemplate.opsForValue().get(KEY)

   // Then the value is null
   assertNull(value)
}
```


The second will update the value of the key using the `RedisTemplate` and fetch the key again using the template.


```
@Test
fun `should successfully fetch the value`() {
   // Given a value stored via RedisTemplate
   redisTemplate.opsForValue().set(KEY, VALUE + 1)

   // When we fetch the value
   val value = redisTemplate.opsForValue().get(KEY)

   // Then the value is null
   assertEquals(VALUE + 1, value)
}
```


As you can see, the first test fails to find the key in Redis and hence returns a `null` value, while the second can find the key after we use our template to update the value.


## Fixing the Issue


To resolve the issue, we need to add serializers to our `RedisTemplate` definition. This ensures that the keys and values are correctly serialized and deserialized when interacting with Redis.


```
@Configuration
class RedisConfiguration {
   @Bean
   fun redisTemplate(connectionFactory: RedisConnectionFactory): RedisTemplate =
       RedisTemplate().apply {
           this.connectionFactory = connectionFactory
           this.keySerializer = StringRedisSerializer()
           this.valueSerializer = GenericToStringSerializer(Int::class.java)
       }
}
```


You can now see that by running the following test, our code will manage to fetch the key successfully:


```
@Test
fun `should successfully fetch value`() {
   // Given predefined int key in Redis

   // When we fetch the value
   val value = redisTemplate.opsForValue().get(KEY)

   // Then the value is correctly fetched
   assertEquals(VALUE, value)
}
```


## Where to Find the Code


All the code presented in this article is available on the GitHub Repository [Redis-Template-Key-Demo](https://github.com/yonatankarp/redis-template-key-demo).


The following branches are available:


- [main](https://github.com/yonatankarp/redis-template-key-demo) – contains the code that presents the issue described in the article


- [value-fetching-fix](https://github.com/yonatankarp/redis-template-key-demo/tree/value-fetching-fix) – contains the fix to the serializer, allowing all tests to pass


## Conclusion


When setting up a Redis client, make sure to configure your key and value serializers to avoid unexpected problems when reading from your cache. The problem might not appear during your tests, but it can suddenly start in production. It’s always better to be explicit when configuring your persistence layer.


## Credits


- Photos by [Johannes Plenio](https://unsplash.com/@niko_photos) on [Unsplash](https://unsplash.com/).
