---
title: "איך להזריק כמה מימושים ב-Spring Framework"
date: 2022-02-11T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - spring-boot
  - dependency-injection
  - spring-framework
categories:
  - Backend
  - Kotlin
translationKey: "inject-multiple-implementations-spring"
description: "סקירה של אסטרטגיות ה-injection השונות שמציע Spring Framework להזרקת מספר implementations של אותו interface ל-bean אחד."
images:
  featured_image: "/images/blog/covers/inject-multiple-implementations-spring.jpg"
---

לא מזמן היה לי דיון עם אחד מהעמיתים שלי במהלך code review. דיברנו על גביש נסתר ב-Spring (וגם ב-frameworks אחרים כמו Micronaut) שיכול לפשט את הקוד שלנו.

בואו נחשוב על משימה: פיתוח מערכת ברכות בוקר טוב שתומכת בעברית ובאנגלית. המערכת צריכה לברך אותנו בכל אחת מהשפות האלה.

נתחיל עם המימוש הפשוט על ידי הגדרת ה-greeters:

```Kotlin
class HebrewGreeter {
    fun sayGoodMorning() {
        println("בוקר טוב")
    }
}

class EnglishGreeter {
    fun sayGoodMorning() {
        println("Good morning")
    }
}
```

עכשיו ניצור קלאס שמחזיק את ה-greeters ומפעיל אותם:

```Kotlin
@Service
class GreeterService(
    private val hebrewGreeter: HebrewGreeter = HebrewGreeter(),
    private val englishGreeter: EnglishGreeter = EnglishGreeter()
) {
    fun greetInAllLanguages() {
        hebrewGreeter.sayGoodMorning()
        englishGreeter.sayGoodMorning()
    }
}
```

המימוש הזה עובד כמצופה. אבל תארו לעצמכם שרוצים להוסיף greeter חדש, כמו greeter גרמני. במקרה כזה, נצטרך לשנות את קלאס `GreeterService`, מה שמפר את [עקרון ה-open-closed](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle) מ-SOLID.

כדי לטפל בבעיה, נגדיר `interface` שעוטף את הפונקציונליות המשותפת של כל ה-greeters:

```Kotlin
interface Greeter {
    fun sayGoodMorning()
}

@Component
class HebrewGreeter : Greeter {
    override fun sayGoodMorning() {
        println("בוקר טוב")
    }
}

@Component
class EnglishGreeter : Greeter {
    override fun sayGoodMorning() {
        println("Good morning")
    }
}

@Component
class GermanGreeter : Greeter {
    override fun sayGoodMorning() {
        println("Guten Morgen")
    }
}
```

עכשיו מגיע החלק המרגש. מאחר שמימשנו interface, ה-`GreeterService` יכול לבקש מ-Spring להזריק את כל המימושים הזמינים לתוך הקונסטרקטור שלו:

```Kotlin
@Service
class GreeterService(private val greeters: List<Greeter>) {
    fun greetInAllLanguages() {
        greeters.forEach { it.sayGoodMorning() }
    }
}
```

הקוד שלנו עכשיו הרבה יותר פשוט, אבל זה לא היתרון היחיד. אם נוסיף greeter חדש בעתיד, הוא יתווסף אוטומטית למערכת בלי צורך בשינויים בקוד!

אפשרות נוספת במקום `List<Greeter>` היא להשתמש ב-`Map<String, Greeter>`. במקרה כזה, Spring יזריק map שבו המפתחות הם שמות הקלאסים המלאים והערכים הם ה-beans המתאימים. לדוגמה, `com.example.greeter.EnglishGreeter`.
