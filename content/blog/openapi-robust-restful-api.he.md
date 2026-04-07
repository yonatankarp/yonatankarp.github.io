---
title: "איך להשתמש ב-OpenApi לבניית RESTful API חזק"
date: 2022-12-04T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - spring-boot
  - openapi
  - rest-api
categories:
  - Backend
translationKey: "openapi-robust-restful-api"
---

<div class="editors-note">

**הערת עורך:** הפוסט הזה נכתב על ידי במקור ופורסם בבלוג של SumUp. אבל הרבה השתנה מאז. אני כבר לא עובד ב-SumUp, OpenAPI שחרר שתי גרסאות major, ל-Spring Boot היה release major, ואפילו ל-Gradle היו כמה releases major. לא רק זאת, כישורי הכתיבה שלי השתפרו דרמטית מאז, ולאורך זמן מצאתי כמה טעויות קטנות במאמר המקורי. מאחר שהמאמר המקורי הוא אחד המוצלחים שלי, החלטתי לכתוב אותו מחדש ולפרסם גרסה מעודכנת.

</div>

## מבוא

### RESTful API — הצד המכוער

כמהנדסת/מהנדס backend, פיתחתי APIs רבים ב-REST במהלך הקריירה שלי. אחת הבעיות הכי מעצבנות שנתקלתי בה שוב ושוב הייתה חוסר בשילוב חלק בין ה-backend לבין הלקוחות. שגיאות כתיב ב-URLs, חוסר עקביות ב-JSON (camel case לעומת snake case), העברת ערכים מהסוג הלא נכון (לדוגמה, string במקום integer) ועוד טעויות דומות קרו לי הרבה פעמים.

![](/images/blog/kb-alex-mccarthy-zmDbLyW7VQg-unsplash-1024x683.jpg)

### שימוש ב-OpenAPI Spec ל-API החדש שלנו

ב-2019, הצוות שלי באותה תקופה היה צריך לתכנן API חדש שישתלב עם כמה לקוחות: mobile (Android ו-iPhone), web ושירותי backend אחרים. רצינו להפוך את תהליך השילוב לחלק ככל האפשר תוך הבטחת חוסן הגדרת ה-API. במהלך sessions של brainstorming, החלטנו להשתמש ב-OpenAPI [[קישור](http://openapis.org)] (שנקרא בעבר Swagger) מההתחלה. למרות שהכרתי כבר את Swagger ככלי תיעוד, הפעם בחרנו לבנות את ה-API בצורה הפוכה. כתוצאה מכך, התחלנו בהגדרת מפרט ה-API עם כל ה-endpoints, הבקשות והתשובות קודם. כל צוות שהיה אחראי על השילוב (backend, mobile ו-web) השתמש ב-OpenApi generator [[קישור](https://openapi-generator.tech/)] לייצור אוטומטי של הקוד שהיה לו צורך בו, כולל models, network layers ו-controllers. בגלל השימוש ברכיבי הקוד שנוצרו האלה בקוד שלנו, ביטלנו מקום לטעויות.

### אימוץ OpenAPI לשילוב טוב יותר

גישת התכנון הזו הוכיחה את עצמה כהצלחה גדולה. למעשה, שכפלנו את אותו תהליך עבור APIs חדשים וראינו צוותים אחרים מאמצים את OpenAPI עבור ה-APIs שלהם. זה הפך לפופולרי כל כך בחברה שהוא אומץ רשמית כסטנדרט לתיאור כל ה-APIs שלנו. זה הקל על מטמיעים פנימיים וחיצוניים כאחד לאמץ את ה-APIs שלנו.

ℹ️ השילוב של OpenAPI היה כל כך חזק שבעבודה החדשה שלי, הצגתי את אותו pattern. הצוות השתמש ב-OpenAPI לייצור תיעוד מהקוד, אבל ההצעה שלי הייתה להפוך את התהליך, כפי שמתואר במאמר הזה.

### מטרות המאמר

במאמר הזה אני אדגים דוגמה של API קצר ופשוט ואוביל אתכם בתהליך שעקבנו אחריו ליצירת REST API עובד. להדגמה זו, נשתמש במחסנית הטכנולוגית הבאה: Spring Boot, Kotlin ו-Gradle's Kotlin DSL לצד (כמובן) OpenApi generator. עם זאת, OpenAPI תומך בשפות שונות רבות, ובחרתי את המחסנית הזו לצורך הדוגמה. אפשר למצוא את רשימת השפות הנתמכות [כאן](https://openapi-generator.tech/docs/generators).

## שלב 1: שימוש ב-OpenAPI Editor לעיצוב ה-API שלנו

![](/images/blog/kb-002-swagger-editor-1024x452.png)

נתחיל בעיצוב ה-API. ל-API שלנו יהיה endpoint אחד: `/greet`. ה-endpoint הזה יקבל שם כ-query parameter (לדוגמה: `/greet?name=Yonatan`). הוא ישיב בברכה **"Hello"** ואחריה השם שסופק.

כדי להגדיר את ה-API שלנו, אפשר להשתמש ב-Swagger Editor [[קישור](https://editor.swagger.io/)] לזיהוי שגיאות syntax מראש. אם אתם משתמשים ב-IntelliJ IDEA, אפשר גם להשתמש ב-OpenAPI Editor plugin [[קישור](https://plugins.jetbrains.com/plugin/14837-openapi-swagger-editor)].

בואו נסתכל על מפרט ה-OpenApi שלנו, ואחר כך נפרק אותו שלב אחר שלב כדי להבין כל אחד מהחלקים השונים שלו.

```
openapi: 3.0.3

info:
  title: Greeting API
  description: "An API that sends a greeting based on a provided name"
  contact:
    name: Yonatan Karp-Rudin
    url: https://yonatankarp.com
  version: 0.1.0

tags:
  - name: Greeting

servers:
  - url: http://localhost:8080/v1
    description: Local development environment

paths:
  /greet:
    get:
      operationId: greet_name
      description: Greet a given name.
      tags:
        - Greeting

      parameters:
        - in: query
          name: name
          schema:
            type: string
          required: false
          description: The name to greet. If no name is provided, the API will greet the world.

      responses:
        200:
          description: Returns a greeting with the provided name.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GreetResponse"

components:
  schemas:
    GreetResponse:
      type: object
      properties:
        greet:
          type: string
          description: The greeting from the API.
          example: "Hello, Yonatan!"

      required:
        - greet
```

### מידע על ה-API

תחום ה-`info` אחראי לספק פרטים על ה-API. המידע הזה יופיע בראש עמוד ה-HTML של התיעוד שנוצר. זה כולל את שם ה-API, תיאורו ופרטי קשר. אפשר למצוא תכונות נוספות לכלול בחלק הזה ב-[API General Info documentation](https://swagger.io/docs/specification/api-general-info/).

### Servers

תחום ה-`servers` מפרט את הסביבות הזמינות (לדוגמה, dev, staging ו-production) למשתמשים לבחור בעת עיון בתיעוד ה-API.

```
servers:
	 - url: https://dev.env
	   description: The development environment.
	 - url: https://staging.env
	   description: The staging environment.
	 - url: https://production.env
	   description: The production environment.
```

### Endpoints

תחום ה-`paths` מגדיר את ה-endpoints השונים של ה-API שלנו, כולל שיטות ה-HTTP, פרמטרי הבקשה והתשובות.

### Models

בתחום ה-`components`, אנחנו מגדירים את המודלים של ה-API. במקרה שלנו, אנחנו מגדירים מודל תשובה ל-endpoint עם שדה אחד. שימו לב שהשדה הזה מסומן כ-required ולכן הוא ייווצר כסוג non-nullable ב-Kotlin באמצעות ה-OpenAPI generator. חלק ה-`components` יכול לכלול מידע נוסף, כמו security schemas (שיטת אימות, headers נדרשים וכו').

## שלב 2: שימוש ב-OpenApi Generator ליצירת הקוד

![](http://test.depilacjapabianice.pl/wp-content/uploads/2023/12/karsten-wurth-0w-uTa0Xz7w-unsplash-1024x683.jpg)

### הוספת OpenAPI Spec לפרויקט

כדי לייצר את הקוד שלנו, נשתמש ב-OpenAPI Generator, ספציפית ב-OpenAPI Generator Gradle plugin [[קישור](https://github.com/OpenAPITools/openapi-generator/tree/master/modules/openapi-generator-gradle-plugin)]. קודם, ניצור מפרט API לפרויקט שלנו. נתחיל ביצירת תיקיית `api` בשורש הפרויקט ונשמור את המפרט בקובץ `spec.yml`. מבנה הפרויקט שלכם אמור להיראות כך:

![](/images/blog/kb-add-spec.gif)

### הגדרת OpenAPI Generator עם Gradle Plugin

עכשיו בואו נוסיף את ה-OpenAPI Generator plugin לפרויקט שלנו. פותחים את הקובץ `build.gradle.kt` ומוסיפים את ה-plugin הבא:

```
plugins {
   id("org.openapi.generator") version "7.2.0"
}
```

עכשיו נגדיר את ה-Gradle plugin לעבוד עם ההגדרות שהגדרנו. נייצר את ה-models שלנו לתיקיית ה-`build`, מה שמבטיח שהקוד שנוצר אוטומטית לא מועלה ל-repository שלנו.

```
val apiDirectoryPath = "$projectDir/src/main/resources/api"
val openApiGenerateOutputDir =
    "${layout.buildDirectory.get()}/generated/openapi"


openApiGenerate {
    generatorName = "kotlin-spring"
    inputSpec = "$apiDirectoryPath/spec.yml"
    outputDir = openApiGenerateOutputDir
    apiPackage = "com.yonatankarp.openapi"
    modelPackage = "com.yonatankarp.openapi.models"
    configOptions =
        mapOf(
            "dateLibrary" to "java8",
            "interfaceOnly" to "true",
            "implicitHeaders" to "true",
            "hideGenerationTimestamp" to "true",
            "useTags" to "true",
            "documentationProvider" to "none",
            "reactive" to "true",
            "useSpringBoot3" to "true",
        )
}
```

אפשר למצוא את ה-flags הזמינים של ה-generator ב-[דוקומנטציה](https://openapi-generator.tech/docs/generators/kotlin-spring).

**ℹ️** למשתמשי SpringBoot 2, ודאו להסיר את ה-flag `useSpringBoot3` מהקוד שלכם לחלוטין, כי ה-generator מתעלם מהערך ב-map ובודק רק אם ה-flag קיים.

### פתרון שגיאות קוד והוספת dependencies

אחרי ייצור הקוד, ייתכן שתראו שגיאות בגלל חבילת `jakarta.validation` החסרה (או `javax.validation` למשתמשי SpringBoot 2). כדי לפתור את זה, הוסיפו את ה-dependency הבא לקובץ `build.gradle.kt` שלכם:

```
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-validation")
}
```

### התאמה אישית של OpenAPI Generator עם Templates

שימו לב שאפשר לעקוף את ה-templates ברירת המחדל של ה-generator אם צריך. אפשר להעתיק את ה-templates מ-[generator repository](https://github.com/OpenAPITools/openapi-generator/tree/master/modules/openapi-generator/src/main/resources), לשנות אותם ולהגדיר אותם ב-plugin באמצעות תכונת `templateDir`.

```
openApiGenerate {
    templateDir = "$apiDirectoryPath/templates"
}
```

למידע נוסף על הגדרות ה-plugin לחצו [כאן](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator-gradle-plugin/README.adoc).

### הבטחת clean build עם Gradle

מומלץ גם להוסיף את הקוד הבא כדי להבטיח שהרצת פקודת `clean` מסירה גם את הקוד שנוצר. בנוסף, כל פקודת קומפילציה של Kotlin (לדוגמה `build` או `assemble`) צריכה להיות תלויה במשימת ייצור OpenAPI כדי לייצר את הקוד האחרון לפני ה-build.

```
tasks {
    register("cleanGeneratedCodeTask") {
        description = "Removes generated Open API code"

        doLast {
            File(openApiGenerateOutputDir).deleteRecursively()
        }
    }

    clean { dependsOn("cleanGeneratedCodeTask") }
}

tasks.withType {
    dependsOn("openApiGenerate")
}
```

### הוספת הקוד שנוצר ל-classpath של הפרויקט

עכשיו צריך להוסיף את הקוד שנוצר ל-classpath של הפרויקט שלנו.

```
sourceSets.main {
    kotlin {
        srcDir("$openApiGenerateOutputDir/src/main/kotlin")
    }
}
```

### ייצור קוד עם Gradle Build

הרצת פקודת `build` ב-Gradle אמורה לייצר את הקוד בקבצי הפרויקט שלכם, בדומה לאפשרות הבאה:

![](/images/blog/kb-generated-code.gif)

## שלב 3: מימוש ה-API! 🎉

![](/images/blog/kb-jefferson-santos-9SoCnyQmkzI-unsplash-1024x683.jpg)

### מימוש הקוד

השלב הזה הוא הפשוט ביותר עד כה. נממש את ה-interface שנוצר, `GreetingApi`, ב-controller שלנו. בואו נכתוב את הקוד!

```
@RestController
class GreetingApiController : GreetingApi {

    override fun greetName(
        @RequestParam(value = "name", required = false) name: String?
    ): ResponseEntity =
        if (name.isNullOrBlank())
            ResponseEntity.ok(GreetResponse("Hello, world!"))
        else
            ResponseEntity.ok(GreetResponse("Hello, $name!"))
}
```

### הרצה ובדיקה של השרת

עכשיו אפשר להריץ את השרת ולבדוק אותו על ידי שליחת בקשה מהדפדפן:

![](/images/blog/kb-call-endpoint.gif)

## שלב 4: כתיבת טסטים

### מבוא לבדיקות API

לבסוף, בואו נוסיף כמה טסטים ל-API שלנו. מאחר שאין logic עסקי בדוגמה הזו, נכלול רק integration test לכיסוי ה-flow המלא. עם זאת, בקוד ה-production שלכם, מומלץ מאוד לכסות את ה-logic העסקי עם unit tests. נשתמש בפונקציונליות `@ParameterizedTest` של JUnit 5 כדי למנוע כפילות קוד. זה יאפשר לנו לעשות reuse לאותו טסט עם inputs שונים כדי לוודא את ההתנהגות של הקוד.

### כתיבת קוד ה-Integration Test

```
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@SpringBootTest
@AutoConfigureMockMvc
@WebAppConfiguration
class GreetingApiControllerTest(context: WebApplicationContext) {
    private val mockMvc = MockMvcBuilders
        .webAppContextSetup(context).build()

    @ParameterizedTest(name = """should return {1} for name "{0}"""")
    @MethodSource("getTestCase")
    fun `should return correct greeting`(name: String?, expectedResult: String) {

        val uri = if (name.isNullOrBlank()) "/v1/greet"
        else "/v1/greet?name=$name"

        val request = MockMvcRequestBuilders.get(uri)
            .accept(MediaType.APPLICATION_JSON)

        val response =
            mockMvc
                .perform(request)
                .andExpect(MockMvcResultMatchers.status().isOk)
                .andReturn()
                .response
                .contentAsString

        val actualGreeting = ObjectMapper()
            .readTree(response)["greet"]
            .asText()
        assertEquals(expectedResult, actualGreeting)
    }

    companion object {
        @JvmStatic
        private fun getTestCase() =
            arrayOf(
                Arguments.of("test", "Hello, test!"),
                Arguments.of(null, "Hello, world!"),
                Arguments.of("💩", "Hello, 💩!"),
            )
    }
}
```

### הרצה ואימות הטסטים

אם עקבתם אחרי ההוראות נכון, הרצת הטסט אמורה לגרום לשני טסטים שעוברים! 🎉

![](/images/blog/kb-passing-tests.gif)

אפשר למצוא את הקוד המלא לפרויקט הזה ב-GitHub repository שלי. מוזמנים לחקור אותו [כאן](https://github.com/yonatankarp/openapi-usage-example).

## סיכום

על ידי שימוש ב-OpenApi, אפשר לאפשר לעצמכם, לצוות שלכם ולמשתמשים הפוטנציאליים תהליך שילוב חלק, חזק ויעיל יותר. תמיד אפשר להשתמש בגישה הזו כשמתכננים API חדש (על ידי יישום [עיקרון ה-API first](https://apidog.com/articles/what-is-api-first/)), ולשקול זאת ל-API קיים כדי להבטיח את חוסנו ושילובים עתידיים עמו.

## קרדיטים

- צילומים מאת [Adam Kool](https://unsplash.com/@adamkool), [Karsten](https://unsplash.com/@karsten_wuerth)[ Würth](https://unsplash.com/@4lexmccarthy) ו-[Jefferson Santos](https://unsplash.com/@jefflssantos) ב-[Unsplash](https://unsplash.com/).
