---
title: "Observability בפעולה: איך להשתמש ב-OpenTelemetry"
date: 2023-10-17T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - spring-boot
  - observability
  - opentelemetry
  - monitoring
categories:
  - Backend
  - Observability
translationKey: "observability-in-action-opentelemetry"
featured_image: "/images/blog/covers/observability-in-action-opentelemetry.jpg"
---

## מבוא

במאמר הזה נצלול לתוך השלבים של הוספת observability לקוד שלכם באמצעות OpenTelemetry. קודם, נפתח ספרייה שמושכת נתונים מ-remote API. אחרי זה, נבנה שירות שמשתמש בספרייה הזו לשליפה ושמירה של הנתונים במסד נתונים.

תוך כדי, נשלב OpenTelemetry ב-Kotlin backend service שלנו, ונדגים את ההתנהגות בסביבה שדומה לפרודקשן. אחרי שהשירות יהיה מצויד ב-instrumentation, נוסיף לו filter שדוחה בקשות גדולות מדי. גם ה-filter הזה יהיה עם instrumentation.

כל דוגמאות הקוד לסדרה הזו זמינות ב-GitHub:

- [cat-fact-client](https://www.github.com/yonatankarp/cat-fact-client)

- [cat-fact-service](https://www.github.com/yonatankarp/cat-fact-service)

## מבוא ל-Service Instrumentation

מה זה service instrumentation? ולמה צריך אותו?

Service instrumentation הוא התהליך של איסוף נתונים מרכיבים שונים במערכת שלכם (לדוגמה שירותים) כדי לקבל תובנות על הביצועים, ההתנהגות והשימוש של המערכת. הנתונים האלה יכולים לשמש לאופטימיזציה של המערכת, לאבחון תקלות ולשיפור חוויית המשתמש.

ספציפית יותר, נשתמש ב-OpenTelemetry [[קישור](https://opentelemetry.io/)]. הדוקומנטציה של OpenTelemetry קובעת:

> *OpenTelemetry, also known as OTel for short, is a vendor-neutral open-source Observability framework for instrumenting, generating, collecting, and exporting telemetry data such as traces, metrics, logs. As an industry-standard, it is natively supported by a number of vendors.*
> זה אומר ש-OpenTelemetry הוא framework שמאפשר לכם להוסיף instrumentation לקוד שלכם בקלות ולאסוף את הנתונים בצורה vendor-agnostic. הוא תומך בשפות תכנות מרובות ומספק API מאוחד לאיסוף וייצוא telemetry data לבאקאנדים שונים. OpenTelemetry גם מספק ספריות ואינטגרציות שמקלות על instrumentation של frameworks, ספריות ושירותים פופולריים. עם OpenTelemetry, מפתחים יכולים בקלות להוסיף telemetry לשירותים שלהם ולקבל visibility לתוך הביצועים וההתנהגות של המערכות שלהם. למידע נוסף על observability, כדאי לקרוא את המאמר המצוין ["How Observability Changed My (Developer) Life"](https://kotlinbackend.com/how-observability-changed-my-developer-life/) שנכתב על ידי עמית שלי, [Mariusz Sołtysiak](https://kotlinbackend.com/author/mariuszsoltysiak/).

## חלק 1 — בניית ספריית ה-Client

נתחיל בפיתוח ספריית ה-client שלנו בשם `cat-fact-client`. הספרייה הזו תשלוף עובדות חתולים מ-[Cat Facts API](https://catfact.ninja/fact).

בבסיסה, הספרייה שלנו פשוטה. היא מנסה לשלוף מספר מסוים של עובדות. למרות שה-API מגביל בחירת עובדות, אנחנו מפצים על כך על ידי קריאה ל-API מספר פעמים לפי הצורך, ומנסים לספק את מספר העובדות המבוקש.

הספרייה שלנו תשתמש ב:

- [Kotlin](https://kotlinlang.org/) — ה-core של הספרייה, היא תיכתב ב-Kotlin עם coroutines.

- [Gradle](https://gradle.org/) — מערכת ה-build ומנהל ה-dependencies.

- [Retrofit](https://square.github.io/retrofit/) — הבחירה שלנו ל-HTTP client.

- [Jackson](https://github.com/FasterXML/jackson) — חיוני ל-serialization, במיוחד כי נשתלב עם [Spring Boot](https://spring.io/projects/spring-boot) שמשתמש ב-Jackson כברירת מחדל.

בואו נתחיל לקודד!

### הוספת Dependencies

מתחילים בהוספת ה-dependencies הנדרשות לקובץ `build.gradle.kts`:

```
dependencies {
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    // Serialization
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.17.1")

    // Retrofit
    api("com.squareup.okhttp3:okhttp:4.12.0")
    api("com.squareup.retrofit2:retrofit:2.11.0")
    api("com.squareup.retrofit2:converter-jackson:2.11.0")
}
```

### Domain Modeling

כשמבצעים ping ל-[Cat Facts API](https://catfact.ninja/fact), מקבלים תשובה בסגנון:

```
{"fact":"Cats have \"nine lives\" thanks to a flexible spine and powerful leg and back muscles","length":83}
```

העניין המרכזי שלנו הוא שדה ה-`fact`. כדי לקבוע את אורך העובדה, פשוט משתמשים ב-`fact.length`. זה מוביל למודל שלנו:

```
data class Fact(val value: String)
```

על ידי שימוש ב-Kotlin [value class](https://kotlinlang.org/docs/inline-classes.html), אנחנו ממטבים את השימוש במשאבים. למרות שאנחנו מתקשרים רק עם אובייקטי Fact, האובייקטים האלה מוחלפים באובייקטי String בזמן קומפילציה.

לכן, שינינו את הקוד ל:

```
@JvmInline
value class Fact(val value: String)
```

### בניית ה-HTTP Client

אחרי שהגדרנו את מודל ה-domain שלנו, הגיע הזמן לבנות HTTP client לקריאות API.

זה יהיה ה-blueprint של ה-client שלנו:

```
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import retrofit2.http.GET

internal interface CatFactClient {
    @GET("fact")
    suspend fun fact(): CatFactResponse
}

@JsonIgnoreProperties(ignoreUnknown = true)
internal data class CatFactResponse(
    val fact: String,
)
```

תבחינו בפונקציה בודדת, `fact()`, שמכוונת לתקשורת עם ה-API ומחזירה `CatFactResponse`. השמטנו בכוונה את שדה ה-`length`, כפי שציינו קודם.

### חיבור הכל יחד

עם הבסיס שנוח, בואו נמזג את הכל ליצירת ה-logic הליבה של הספרייה שלנו.

נתחיל בקנפוג instance של ה-HTTP client:

```
private const val API_BASE_URL = "https://catfact.ninja/"

private var client = Retrofit.Builder()
    .baseUrl(API_BASE_URL)
    .client(OkHttpClient.Builder().build())
    .addConverterFactory(JacksonConverterFactory.create(objectMapper))
    .build()
    .create()
```

עכשיו ה-business logic שלנו:

```
override suspend fun get(numberOfFacts: Int): Set =
    coroutineScope {
        (1..numberOfFacts).map {
            async { client.fact() }
        }.awaitAll()
            .map { Fact(it.fact) }
            .toSet()
    }
```

הפונקציה הזו שולחת בו-זמנית `numberOfFacts` קריאות ל-API, מחכה לכל התשובות, ממירה אותן למודל ה-domain ומחזירה set של עובדות. אנחנו משתמשים ב-`Set` במקום `List` כי ה-API לא מבטיח תשובות ייחודיות.

ניתן לבדוק את הגרסה הסופית של הקוד [כאן](https://github.com/yonatankarp/cat-fact-client/blob/implement-fetch-cat-facts/src/main/kotlin/cat/fact/client/CatFactProvider.kt).

## חלק 2 — בניית השירות

כל דוגמאות הקוד הקשורות לשירות הזה זמינות [כאן](https://github.com/yonatankarp/cat-fact-service/tree/business-logic-implementation) ב-branch `business-logic-implementation`.

השירות כולל את הפיצ'רים הבאים:

- כל בקשה מחזירה מספר מסוים של עובדות חתולים (בין 1-10) באמצעות ספריית `cat-fact-client`. אם לא מצוין, ברירת המחדל היא 5 עובדות

- כל עובדה נשמרת במסד הנתונים אלא אם כבר שמורה שם.

- העובדות שנשלפו נשלחות חזרה למבקש.

אולי תשאלו, ***"מתי אי פעם אצטרך את זה?!"*** זה בעיקר use case להדגמה. תדמיינו תרחיש שבמקום קריאה ל-facts API, אתם קוראים לשירות ניהול משתמשים כדי לוודא שה-context של המשתמש נשמר בבקשה.

### הוספת Dependencies

כדי לשלב את הספרייה שלנו, מוסיפים את ה-dependency הבא לפרויקט:

```
repositories {
    maven {
        url = uri("https://maven.pkg.github.com/yonatankarp/cat-fact-client")
        credentials {
            username = project.findProperty("gpr.user")?.toString() ?: System.getenv("GITHUB_ACTOR")
            password = project.findProperty("gpr.key")?.toString() ?: System.getenv("GITHUB_TOKEN")
        }
    }
}
```

ודאו שיש לכם PAT (Personal Access Token) עם הרשאת `read:packages` כדי לגשת לספרייה. הוראות מפורטות על יצירת PAT ניתן למצוא [כאן](https://docs.github.com/en/packages/learn-github-packages/about-github-packages#authenticating-to-github-packages).

לאחר מכן מוסיפים את ה-dependency לפרויקט:

```
dependencies {
    implementation("com.yonatankarp:cat-fact-client:0.2.0")
}
```

### טעינת העובדות

מתחילים בהגדרת ה-interface של `RequestContext`, שיטען עובדות לכל בקשה. Spring ישתמש במימוש שלו, `RequestContextImpl`, להזרקת עובדות ל-controller.

```
/**
 * Provides facts about cats into the request context.
 *
 * This interface is used by SpringBoot to inject the user context into
 * the controller for each call made for the service.
 */
interface RequestContext {
    var facts: Set?
}

/**
 * The implementation of the [RequestContext] interface. Used by
 * SpringBoot to populate the facts into the request context.
 */
open class RequestContextImpl(
    override var facts: Set? = null
) : RequestContext
```

עכשיו נגדיר שה-context יכלל עם כל בקשה שמגיעה לשירות. שימו לב שאנחנו משתמשים ב-`ObjectMapper` של Jackson עבור ספריית `cat-fact-client`, כי זו ספריית ה-serialization ברירת המחדל של Spring. יתרה מזאת, ה-annotation `@Scope` מצריך פונקציה לא מושהית, ולכן צריך להשתמש ב-`runBlocking{}` כגשר בין הספרייה לשירות.

```
@Configuration
class ApplicationConfiguration {
    /**
     * Creates a new instance of the [CatFactProvider] that will be 
     * used to fetch the facts about cats.
     */
    @Bean
    fun catFactProvider(objectMapper: ObjectMapper): CatFactProvider =
        CatFactFactory.getInstance(ProviderType.API, objectMapper)

    /**
     * Creates a new instance of the [RequestContext] that will be 
     * used to inject the facts into the request context.
     */
    @Bean
    @Scope(
        WebApplicationContext.SCOPE_REQUEST,
        proxyMode = ScopedProxyMode.INTERFACES
    )
    fun requestContext(
        catFactProvider: CatFactProvider
    ): RequestContext = runBlocking {
        RequestContextImpl(catFactProvider.get(getMaxFactsNumber()))
    }

    /**
     * Returns the maximum number of facts that should be returned 
     * to the caller, or the default value if not specified.
     */
    private fun getMaxFactsNumber(): Int {
        val servletRequestAttributes =
            RequestContextHolder.getRequestAttributes() as ServletRequestAttributes

        return servletRequestAttributes
            .request
            .getParameterValues("max")
            ?.first()
            ?.toInt()
            ?.coerceIn(MIN_FACTS_NUMBER, MAX_FACTS_NUMBER)
            ?: DEFAULT_FACTS_NUMBER
    }

    companion object {
        private const val DEFAULT_FACTS_NUMBER = 5
        private const val MIN_FACTS_NUMBER = 1
        private const val MAX_FACTS_NUMBER = 10
    }
}
```

### אחסון וקריאה של עובדות

עם העובדות שנמצאות עכשיו ב-request context, ניתן להשתמש בהן ב-controller שלנו.

```
@RestController
class CatFactController(
    // Would be automatically injected by Spring
    private val requestContext: RequestContext,
    private val catFactService: CatFactService,
) {
    @GetMapping("/api/v1/cat/facts")
    suspend fun getCatFacts(): ResponseEntity {
        val facts = requestContext.facts ?: throw RuntimeException("Could not read facts")
        catFactService.storeFacts(facts)
        return ok(facts.toResponse())
    }
}

private fun Set.toResponse() = FactsResponse(this)

data class FactsResponse(val facts: Set)
```

השירות הפשוט יחסית שלנו פשוט עובר על העובדות הזמינות ושומר כל אחת.

```
@Service
class CatFactService(private val repository: CatFactRepository) {
    suspend fun storeFacts(facts: Set) =
        facts.forEach { repository.storeFacts(it) }
}
```

השלב הנותר הוא שמירת העובדות שלנו במסד הנתונים. נשתמש ב-[Flyway](https://flywaydb.org/) למיגרציות של מסד הנתונים וב-[JOOQ](https://www.jooq.org/) לאינטראקציה עם מסד הנתונים. מתחילים ביצירת טבלה במסד הנתונים.

מוסיפים את סקריפט ה-SQL הבא לתיקיית `src/main/resources/db/migration/V1.0.0__init_db.sql`:

```
CREATE TABLE cat_facts (
    hash INT PRIMARY KEY,
    fact TEXT NOT NULL
);
```

לעובדות אין מזהים ייחודיים, אז נשתמש ב-hash של העובדה כדי לבדוק אם היא כבר במסד הנתונים. למרות שהשיטה הזו אינה אידיאלית, היא מתאימה לצרכים שלנו.

לבסוף, נפתח repository לשמירת העובדות במסד הנתונים. ה-repository הפשוט הזה יוסיף עובדות וידלג על אלה שכבר קיימות.

```
@Repository
class CatFactRepository(private val jooq: DSLContext) {
    suspend fun storeFacts(fact: Fact) =
        with(Tables.CAT_FACTS) {
            jooq.insertInto(this, HASH, FACT)
                .values(fact.hashCode(), fact.value)
                .onConflict(HASH)
                .doNothing()
                .execute()
        }
}
```

### Dockerizing הפרויקט

כדי לשחזר את ההתנהגות בפרודקשן של השירותים שלנו, נשתמש ב-Docker ליצירת image ואחר כך נבדוק את השירות שלנו.

```
FROM --platform=linux/x86_64 eclipse-temurin:17-jre-alpine

ENV APP_BASE="/home" \
    APP_NAME="cat-fact-service" \
    SERVER_PORT="8080"

EXPOSE ${SERVER_PORT}

# Install helper tools for debugging
RUN apk update && apk upgrade && apk add curl openssl gcompat bash busybox-extras iputils

RUN mkdir -p ${APP_BASE}/${APP_NAME}

COPY build/libs/${APP_NAME}*.jar ${APP_BASE}/${APP_NAME}.jar

CMD java -jar ${APP_BASE}/${APP_NAME}.jar
```

כדי לאמת שהפרויקט פועל, מריצים:

```
$ ./gradlew assemble
$ docker build -t cat-fact-service .
```

### הגדרת docker-compose

בעוד שהשירות פועל, הגדרת מסד הנתונים עדיין חסרה. docker-compose יקים גם את מסד הנתונים וגם את השירות.

בשורש הפרויקט, יוצרים קובץ חדש בשם `docker-compose.yml` עם התוכן הבא:

```
version: '3'

services:
  cat-fact-service:
    container_name: cat-fact-service
    networks:
      - proxynet
    build: ../..
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=facts
      - DB_USER=postgres
      - DB_PASSWORD=secret

  postgres:
    container_name: cat-fact-service-postgres
    networks:
      - proxynet
    image: postgres:14
    restart: always
    environment
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: facts
    ports:
      - "5432:5432"

networks:
  proxynet:
    name: cat-fact-service-network
```

### הרצת השירות

עכשיו אפשר להפעיל ולבדוק את השירות על ידי הרצת:

```
$ docker-compose up
```

אחרי ש-Spring מודיע שהשירות פועל, ניגשים אליו דרך הדפדפן ב-[http://localhost:8080/api/v1/cat/facts](http://localhost:8080/api/v1/cat/facts).

אם הכל הוגדר נכון, התשובה אמורה להיראות כך:

![](/images/blog/kb-image-1.png)

כדי לקבל מספר מותאם אישית של עובדות, משתמשים ב-query parameter `max`. לעשר עובדות, עוברים ל-[http://localhost:8080/api/v1/cat/facts?max=10](http://localhost:8080/api/v1/cat/facts?max=10).

![](/images/blog/kb-image-2.png)

בדיקת מסד הנתונים תאשר שמירה מוצלחת של עובדות.

![facts stored inside Postgres database](/images/blog/kb-image-1024x571.png)

ה-logic של השירות שלנו מוכן!

## חלק 3 — הגדרת Instrumentation עם OpenTelemetry

דוגמאות הקוד הקשורות לשירות הזה ניתן למצוא [כאן](https://github.com/yonatankarp/cat-fact-service/tree/add-instumentation) ב-branch `add-instumentation`.

### HoneyComb.io

#### מבוא

במאמר הזה, נשתמש ב-[HoneyComb.io](https://www.honeycomb.io/) כ-tracing backend שלנו. למרות שיש כלים אחרים בשוק, חלקם ניתן להריץ על המחשב המקומי שלכם (לדוגמה, [Jaeger](https://www.jaegertracing.io/)), בחרתי ב-HoneyComb בגלל הכלים המשלימים שלהם שמציעים ניטור משופר של השירות ותובנות על התנהגותו.

HoneyComb היא פלטפורמת observability מבוססת ענן שעוזרת למפתחים לקבל תובנות על מערכות התוכנה שלהם. הם מספקים כלים כמו SLA/SLO monitoring, distributed tracing ואגרגציה של logs בזמן אמת. זה מאפשר לנו לזהות ולתקן בעיות במהירות לפני שהן משפיעות על משתמשים. HoneyComb פועל על מודל נתונים מבוסס events, מה שאומר שמהנדסים יכולים לחקור ולנתח נתונים בזמן אמת, לצלול לתוך בעיות ספציפיות כדי לזהות את הסיבה השורשית ולנקוט פעולה מתקנת.

#### הגדרה

ניתן להירשם לחשבון HoneyComb חינמי שמעבד עד 20 מיליון events לחודש, מה שיותר ממספיק לצרכים שלנו. כדי ליצור חשבון, בקרו ב-[HoneyComb.io](https://www.honeycomb.io/), לחצו על כפתור `Start for Free`, מלאו את הפרטים שלכם והגדירו team.

לצורך המאמר הזה, נשתמש בסביבת ה-`test` ברירת המחדל, אבל ניתן ליצור סביבות נוספות לפי הצורך.

אחרי ההגדרה, אמורים להגיע לדף שנראה כך:

![](/images/blog/kb-image-3-1024x571.png)

עכשיו ניצור API key חדש כדי שהשירות שלנו ישלח נתונים ל-HoneyComb. לחצו על `Account` ➡️ `Team settings`.

![](/images/blog/kb-image-4.png)

תחת חלק `Environments and API Keys`, לחצו על כפתור `Manage`.

![](/images/blog/kb-image-5-1024x571.png)

בדף הבא, לחצו על כפתור `Create API Key` ותנו לו שם. לצורך המדריך הזה, נקרא לו `local` (שמציין ריצה מקומית). רוצים להגביל את היקף המפתח למינימום הנדרש, כך שלמפתח יהיו רק הרשאות `Send events` ו-`Create datasets`.

![](/images/blog/kb-image-6.png)

אחרי שביצעתם את הבחירות האלה, לחצו על כפתור `Save`. עכשיו אמורים לראות את המפתח מוצג על המסך. נשתמש במפתח הזה מאוחר יותר כשנקנפג את השירות שלנו.

### הגדרת OpenTelemetry

חלק זה יפרט כיצד לצייד את השירות שלנו ב-OpenTelemetry, שהוא המוקד העיקרי של המאמר הזה.

#### דרישות מוקדמות

כדי להשיג זאת, נוסיף לפרויקט שלנו את הדברים הבאים:

- OpenTelemetry Agent — לטרייסינג אוטומטי

- OpenTelemetry SDK — לטרייסינג ידני

- Gradle task לשליפת OpenTelemetry Java agent לפני כל build

- קונפיגורציה של ה-OpenTelemetry agent בתוך task ה-`bootRun` לבדיקה מקומית

- שינויים ב-`Dockerfile` לשילוב ה-OpenTelemetry agent

- שינויים בקובץ `docker-compose.yml` להוספת הגדרות הסביבה של ה-OpenTelemetry agent

#### שילוב ה-OpenTelemetry SDK וה-Agent

קודם, נוסיף את ה-dependencies של OpenTelemetry SDK ו-agent לפרויקט. HoneyComb מספקת ספרייה שמרחיבה את הפונקציונליות הבסיסית של JVM OpenTelemetry, ונשתמש בה.

##### שילוב Dependencies

נתחיל בהוספת ה-dependencies שלנו ב-`build.gradle.kts`:

```
dependencies {
  implementation("io.honeycomb:honeycomb-opentelemetry-sdk:1.7.0")
  // We're using compileOnly as we need this dependency only to set the
  // agent on our docker image and local development
  compileOnly("io.honeycomb:honeycomb-opentelemetry-javaagent:1.7.0")
}
```

##### בניית Gradle Task ל-OpenTelemetry Agent

אחרי שסיימנו, ניצור Gradle task חדש (בשם `copyOpenTelemetryAgent`) שיעתיק את ה-OpenTelemetry agent לתיקיית `build/output/libs` לפני כל build על ידי גרימת ה-task `build` להיות תלוי בו.

```
tasks {
  build {
    dependsOn("copyOpenTelemetryAgent")
  }    

  register("copyOpenTelemetryAgent") {
    project.delete(
        fileTree("${layout.buildDirectory.get().asFile}/output/libs")
    )

    from(configurations.compileClasspath)
    into("${layout.buildDirectory.get().asFile}/output/libs")
    include("honeycomb-opentelemetry-javaagent*")
    // We want to remove the version from the jar file name for easier
    // referencing during the service execution
    rename("-[1-9]+.[0-9]+.[0-9]+.jar", ".jar")
  }
}
```

אפשר לרענן את Gradle ולראות שה-task החדש מופיע:

![](/images/blog/kb-open-telemetry-agent-task.gif)

ניתן להריץ את task ה-`build` ולראות שה-OpenTelemetry agent מועתק לתיקיית `build/output/libs`:

![](/images/blog/kb-otel-jar-location.gif)

##### שינוי task ה-bootRun

עכשיו נעדכן את task ה-`bootRun` כדי לכלול את ה-OpenTelemetry agent. על ידי כך, נוכל להריץ את השירות מקומית ולגרום לו לשלוח נתונים ל-HoneyComb.

מוסיפים את הדברים הבאים ל-task ה-`bootRun` בקובץ `build.gradle.kts`:

```
tasks {
    bootRun {
        environment = mapOf(
            "HONEYCOMB_API_KEY" to System.getenv("HONEYCOMB_API_KEY"),
            "SERVICE_NAME" to "cat-fact-service",
            "HONEYCOMB_API_ENDPOINT" to "https://api.honeycomb.io:443",
            "ENVIRONMENT" to "test",
        )

        jvmArgs = listOf(
            "-javaagent:${layout.buildDirectory.get().asFile}/output/libs/honeycomb-opentelemetry-javaagent.jar",
            // Passing static parameter to the collector, in this case - 
            // a reference to the GitHub repository
            "-Dotel.resource.attributes=github.repository=https://github.com/ForkingGeniuses/cat-fact-service",
        )
    }
}
```

שימו לב שכדי לעבוד, ה-task הזה צריך שמשתנה הסביבה `HONEYCOMB_API_KEY` יוגדר עם ה-API key שיצרנו קודם. כמו כן, כרגע אנחנו קוראים ישירות ל-HoneyComb API, ולכן צריך להגדיר את משתנה הסביבה `HONEYCOMB_API_ENDPOINT` ל-`https://api.honeycomb.io:443`. במאמר עתידי, אולי נתקן את זה על ידי שימוש ב-OpenTelemetry collector.

#### הרצת השירות מקומית

עכשיו אפשר להריץ את השירות ולצפות בנתונים שנשלחים ל-HoneyComb.

כדי להריץ את השירות, מריצים את הפקודה הבאה (ודאו שמסד הנתונים רץ):

```
$ ./gradlew bootRun
```

יוצרים נתונים על ידי גישה ל-endpoint כמה פעמים:

```
$ curl http://localhost:8080/api/v1/cat/facts
```

עוברים ל-HoneyComb UI ולוחצים על כפתור ה-`Query`. אפשר ללחוץ על כפתור `Run Query` כדי לראות את הנתונים שנשלחים ל-HoneyComb. ניתן לראות לדוגמה את ה-attribute `github.repository` שלנו שנשלח:

![](/images/blog/kb-image-9-1024x400.png)

ניתן גם ליצור גרף לוויזואליזציה של הנתונים על ידי בחירת כל דבר תחת תיבת `VISUALIZE`. לדוגמה:

![](/images/blog/kb-image-10-1024x643.png)

לבסוף, ניתן לצלול לתוך trace ספציפי על ידי לחיצה על ה-traces ולראות את נתיב הביצוע של הבקשה:

![](/images/blog/kb-image-11-1024x553.png)

##### שינוי ה-Dockerfile

הרצת השירות מקומית זה נהדר, אבל רוצים להריץ אותו ב-container. על ידי כך, ניתן להריץ את השירות בסביבה שיותר דומה לפרודקשן.

השינויים הנדרשים להרצת השירות ב-container הם מינימליים. צריך להוסיף את ה-OpenTelemetry agent ל-container ולהגדיר את משתני הסביבה הנדרשים על ידי ה-agent.

גם נוסיף את ה-attributes הסטטיים שלנו ל-agent, כך שנוכל לסנן בקלות את הנתונים ב-HoneyComb. ניתן לקבל מספר attributes מופרדים בפסיק. לדוגמה:

```
github.repository=https://github.com/yonatankarp/cat-fact-service,slack.channel=#cat-facts
```

ה-`Dockerfile` המעודכן שלנו ייראה כך:

```
FROM --platform=linux/x86_64 eclipse-temurin:17-jre-alpine

 ENV APP_BASE="/home" \
     APP_NAME="cat-fact-service" \
+    OTEL_ATTRIBUTES="github.repository=https://github.com/yonatankarp/cat-fact-service" \
     SERVER_PORT="8080"

 EXPOSE ${SERVER_PORT}
 RUN apk update && apk upgrade && apk add curl openssl gcompat bash busybox-extra

 RUN mkdir -p ${APP_BASE}/${APP_NAME}

+# Otel agent
+COPY "/build/output/libs" "${APP_BASE}/${APP_NAME}"
+
+COPY "/build/libs/${APP_NAME}*.jar" "${APP_BASE}/${APP_NAME}.jar"


 CMD java $JAVA_OPTS \
+    -Dotel.resource.attributes="${OTEL_ATTRIBUTES}" \
+    -javaagent:${APP_BASE}/${APP_NAME}/honeycomb-opentelemetry-javaagent.jar \
     -jar ${APP_BASE}/${APP_NAME}.jar
```

##### שינוי קובץ docker-compose.yml

לבסוף, ה-`docker-compose.yml` יצטרך עדכון להוספת משתני הסביבה הנדרשים:

```
@@ -16,6 +16,10 @@ services:
      - DB_NAME=facts
      - DB_USER=postgres
      - DB_PASSWORD=secret
+      - HONEYCOMB_API_KEY=${HONEYCOMB_API_KEY}
+      - SERVICE_NAME=cat-fact-service
+      - HONEYCOMB_API_ENDPOINT=https://api.honeycomb.io:443
+      - OTEL_JAVAAGENT_DEBUG=false

  postgres:
    container_name: cat-fact-service-postgres
```

מפעילים את כל הקונפיגורציה באמצעות `docker-compose`:

```
$ docker compose up
```

## סיכום

במאמר הזה עקבנו אחרי השלבים של בניית ה-business logic שלנו בספרייה, שילובה בשירות REST, והוספת instrumentation למערכת כדי לנטר את התנהגותה. אני מקווה שעזרתי לכם לראות איך שדרוג הקוד שלכם עם OpenTelemetry מאפשר לכם לנטר את השירות שלכם ולקבל תובנות יקרות ערך על התנהגותו. על ידי שילוב [HoneyComb.io](http://honeycomb.io/), ה-OpenTelemetry SDK וה-agent, ניתן להגדיר observability לשירות שלכם ביעילות תוך ניצול כלי הניתוח החזקים של HoneyComb.

## הכרת תודה

[Mariusz Sołtysiak](https://medium.com/@mariuszsoltysiak) — על תמיכה מוסרית, review והצעות בזמן כתיבת המאמר הזה.

## קרדיטים

- צילומים מאת [niko photos](https://unsplash.com/@niko_photos) ב-[Unsplash](https://unsplash.com/).
