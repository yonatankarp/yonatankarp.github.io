---
title: "איך לתקן קונפיגורציות שגויות ב-RedisTemplate"
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
translationKey: "fix-misconfigurations-redistemplate"
---

## מבוא

הסיפור שלנו מתחיל עם עמית ואני שמנסים לדבג בעיה בפרויקט שלנו כמה שעות. היינו צריכים לשלוף ערך מ-Redis, אבל בכל פעם שהשירות רץ, הערך שחזר היה `null`. למרות המאמצים שלנו, לא מצאנו פתרון באינטרנט, ולמרות הכל — הקוד שלנו היה מכוסה בטסטים שכולם עברו!

במאמר הזה נחקור בעיה נפוצה כשמשתמשים ב-`RedisTemplate` באפליקציות Spring. נדגים איך קונפיגורציות שגויות יכולות לגרום לכך שהטסטים עוברים אבל שליפת הנתונים הנכונים נכשלת. בנוסף, נראה איך לקנפג `RedisTemplate` בצורה נכונה כדי להימנע מהבעיה.

## קונפיגורציה ראשונית

כדי לקנפג את האפליקציה להתחבר ל-Redis, נוסיף את הקונפיגורציות הבאות לקובץ `application.yml`:

```
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
```

הקונפיגורציה הזו מגדירה את ה-Redis host וה-port, כשברירת מחדל הם `localhost` ו-`6379` אם לא סופקו משתני סביבה.

## יצירת ה-RedisTemplate Bean

עכשיו ניצור את ה-bean של `RedisTemplate` שישמש כ-Redis client בקוד שלנו.

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

בקוד הזה, אנחנו מגדירים `RedisTemplate` עם טיפוס מפתח `String` וטיפוס ערך `Int`, ומשייכים אותו ל-Redis connection factory.

## כתיבת טסטים

בשלב הבא, ניצור טסט שמשתמש ב-Redis test container:

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

עכשיו נגדיר את ה-Redis host וה-port לערכים של ה-test container שלנו:

```
@DynamicPropertySource
@JvmStatic
@Suppress("unused")
fun registerDynamicProperties(registry: DynamicPropertyRegistry) {
   registry.add("spring.data.redis.host") { redisContainer.host }
   registry.add("spring.data.redis.port") { redisContainer.getMappedPort(REDIS_PORT) }
}
```

עכשיו נוודא שה-Redis cache מתאפס בין טסטים, ונכניס מפתח וערך מוגדרים מראש ל-Redis באמצעות כלי ה-`redis-cli`.

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

## זיהוי הבעיה

על ידי הרצת הטסט הבא עם breakpoint ובדיקת הcontainer שמריץ את הפקודה, אפשר לראות שהמפתח אכן מאוחסן ב-container שלנו.

```
$ docker exec -it  redis-cli
127.0.0.1:6379> keys *
1) "key"
```

עכשיו נכתוב שני טסטים. הראשון ינסה לשלוף את הערך מה-container ישירות באמצעות ה-bean של `RedisTemplate` שלנו.

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

השני יעדכן את ערך המפתח באמצעות ה-`RedisTemplate` וישלוף את המפתח שוב באמצעות ה-template.

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

כפי שניתן לראות, הטסט הראשון לא מצליח למצוא את המפתח ב-Redis ולכן מחזיר `null`, בעוד שהשני מצליח למצוא את המפתח אחרי שהשתמשנו ב-template לעדכון הערך.

## תיקון הבעיה

כדי לפתור את הבעיה, צריך להוסיף serializers להגדרת ה-`RedisTemplate`. זה מבטיח שהמפתחות והערכים מסוריאלזים ודה-סוריאלזים בצורה נכונה כשמתקשרים עם Redis.

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

עכשיו אפשר לראות שהרצת הטסט הבא תצליח לשלוף את המפתח בהצלחה:

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

## איפה למצוא את הקוד

כל הקוד שמוצג במאמר הזה זמין ב-GitHub Repository [Redis-Template-Key-Demo](https://github.com/yonatankarp/redis-template-key-demo).

ה-branches הזמינים הם:

- [main](https://github.com/yonatankarp/redis-template-key-demo) — מכיל את הקוד שמדגים את הבעיה המתוארת במאמר

- [value-fetching-fix](https://github.com/yonatankarp/redis-template-key-demo/tree/value-fetching-fix) — מכיל את התיקון ל-serializer, שמאפשר לכל הטסטים לעבור

## סיכום

כשמגדירים Redis client, ודאו שאתם מגדירים את ה-serializers של המפתחות והערכים כדי להימנע מבעיות בלתי צפויות בקריאה מה-cache שלכם. הבעיה אולי לא תופיע במהלך הטסטים, אבל היא יכולה לצוץ פתאום בפרודקשן. תמיד עדיף להיות מפורשים כשמקנפגים את שכבת ה-persistence.

## קרדיטים

- צילומים מאת [Johannes Plenio](https://unsplash.com/@niko_photos) ב-[Unsplash](https://unsplash.com/).
