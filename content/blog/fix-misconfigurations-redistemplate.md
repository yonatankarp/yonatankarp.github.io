---
title: "How to Fix Misconfigurations in RedisTemplate"
date: 2024-06-05T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - spring-boot
  - redis
  - redistemplate
categories:
  - Backend
---

Table of Contents

[Toggle
](#)


- [Introduction](#Introduction)
- [Initial Configuration](#Initial_Configuration)
- [Creating the RedisTemplate Bean](#Creating_the_RedisTemplate_Bean)
- [Writing Tests](#Writing_Tests)
- [Identifying The Issue](#Identifying_The_Issue)
- [Fixing the Issue](#Fixing_the_Issue)
- [Where to Find the Code](#Where_to_Find_the_Code)
- [Conclusion](#Conclusion)
- [Credits](#Credits)


## Introduction


Our story begins with a colleague and me trying to debug an issue with our project for a few hours. We needed to fetch a value from Redis storage, but whenever the service ran, the fetched value was `null`. Despite our efforts, we couldn't find a solution on the internet, and to make matters worse, our code was actually covered by tests that had all passed!


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


						
						

						
							[Kotlin](https://kotlinbackend.com/tag/kotlin/)[Redis](https://kotlinbackend.com/tag/redis/)[Spring Boot](https://kotlinbackend.com/tag/springboot/)							
							
								
								[
									![](https://secure.gravatar.com/avatar/6c154e551138bab9676d28f6a32fd694286d33d3ff98f4e6db45d3b1c2ed6fb3?s=100&#038;d=mm&#038;r=g)								](https://kotlinbackend.com/author/yonatankarp/)
								
								
#### Yonatan Karp-Rudin


								
									
										
Software engineer with over 12 years experience. Love Kotlin, event driven architecture and clean code ❤️

									

								
							

									
		
			
			
Read Next &rarr;

			
			
							
								
						[
							
															
								![](/images/blog/kb-image-11-400x200.png)								
														
							

								Kotlin							

					
							
### Convert HTML to PDF with Kotlin/JVM

								
						](https://kotlinbackend.com/convert-html-to-pdf-with-kotlin-jvm/)
					
										
						[
							
															
								![](/images/blog/kb-niko-photos-tGTVxeOr_Rs-unsplash-400x200.jpg)								
														
							

								DevOps							

					
							
### Observability in Action: How to Use OpenTelemetry

								
						](https://kotlinbackend.com/observability-in-action-how-to-use-opentelemetry/)
					
										
						[
							
															
								![](/images/blog/kb-robert-lukeman-_RBcxo9AU-U-unsplash-400x200.jpg)								
														
							

								Gradle							

					
							
### How To Build Your  Domain Gateway With OpenApi

								
						](https://kotlinbackend.com/how-to-build-your-domain-gateway-with-openapi/)
					
									
			

		
		
								
																
					
					
				
				
				
	
			
		
### Leave a Reply Cancel reply

Comment*

Name * 


Email * 


Website 


 Save my name, email, and website in this browser for the next time I comment.


      
         Yes, add me to your mailing list
      
    

 


&#916;
	
		

		
	
	
	

	SearchSearch


## Recent Posts


- [XKCD: From Tile to Picture – Seeing the Full Image](https://kotlinbackend.com/xkcd-from-tile-to-picture-seeing-the-full-image/)

- [How to Fix Misconfigurations in  RedisTemplate](https://kotlinbackend.com/how-to-fix-misconfigurations-in-redistemplate/)

- [Convert HTML to PDF with Kotlin/JVM](https://kotlinbackend.com/convert-html-to-pdf-with-kotlin-jvm/)

- [Decoding the challenge of business urgency and engineering rigor](https://kotlinbackend.com/decoding-the-challenge-of-business-urgency-and-engineering-rigor/)

- [Observability in Action: How to Use OpenTelemetry](https://kotlinbackend.com/observability-in-action-how-to-use-opentelemetry/)


## Recent Comments


- [How To Build Your Domain Gateway With OpenApi - Kotlin Backend](https://kotlinbackend.com/how-to-build-your-domain-gateway-with-openapi/) on [API Versioning with Kotlin and Spring Boot](https://kotlinbackend.com/api-versioning-with-kotlin-and-spring-boot/#comment-50)
- [Things I learned as a software engineer — career development - Kotlin Backend](https://kotlinbackend.com/things-i-learned-as-a-software-engineer-career-development/) on [Things I learned as a software engineer](https://kotlinbackend.com/the-things-i-learned-as-a-software-engineer/#comment-26)
- [Yonatan Karp-Rudin](http://test.depilacjapabianice.pl) on [How To Build Your  Domain Gateway With OpenApi](https://kotlinbackend.com/how-to-build-your-domain-gateway-with-openapi/#comment-20)
- [Hazel Lovette](https://sveltcolza.com) on [How To Build Your  Domain Gateway With OpenApi](https://kotlinbackend.com/how-to-build-your-domain-gateway-with-openapi/#comment-9)
- [How To Build Your Domain Gateway With OpenApi -](https://kotlinbackend.com/how-to-build-your-domain-gateway-with-openapi/) on [How to Use OpenApi to Build a Robust RESTful API](https://kotlinbackend.com/how-to-use-openapi-to-build-a-robust-restful-api/#comment-6)


  
  
  
  

    

    
      
      
      
      
      

      Please leave this field empty
# Join Our Newsletter to Stay Up-to-Date


*We don’t spam! Read our [privacy policy](https://kotlinbackend.com/privacy-policy/) for more info.*


      
        
Check your inbox or spam folder to confirm your subscription.
        

        
        

      
    

      

  


## Categories


	
- [Career & development](https://kotlinbackend.com/category/career-development/)
	
- [DevOps](https://kotlinbackend.com/category/devops/)
	
- [Gradle](https://kotlinbackend.com/category/gradle/)
	
- [Hacking](https://kotlinbackend.com/category/hacking/)
	
- [Kotlin](https://kotlinbackend.com/category/kotlin/)
	
- [OpenApi](https://kotlinbackend.com/category/openapi/)
	
- [Spring & Spring Boot](https://kotlinbackend.com/category/spring/)


[Career](https://kotlinbackend.com/tag/career/)
[Design Pattern](https://kotlinbackend.com/tag/design-pattern/)
[DevOps](https://kotlinbackend.com/tag/devops/)
[Experience](https://kotlinbackend.com/tag/experience/)
[hacking](https://kotlinbackend.com/tag/hacking/)
[HTML](https://kotlinbackend.com/tag/html/)
[Kotlin](https://kotlinbackend.com/tag/kotlin/)
[Observability](https://kotlinbackend.com/tag/observability/)
[PDF](https://kotlinbackend.com/tag/pdf/)
[Redis](https://kotlinbackend.com/tag/redis/)
[RESTful API](https://kotlinbackend.com/tag/restful-api/)
[Software Development](https://kotlinbackend.com/tag/software-development/)
[Spring Boot](https://kotlinbackend.com/tag/springboot/)
[xkcd](https://kotlinbackend.com/tag/xkcd/)

	

		
		

		
					
			
				
				[
					
					To the top
				](#)
				
				
&copy; 2026 [Kotlin Backend](https://kotlinbackend.com/)

				
				
Theme by [Anders Nor&eacute;n](https://www.andersnoren.se)
