---
title: "איך לשבור HashMap בפחות מדקה"
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
translationKey: "break-hashmap-less-than-a-minute"
description: "הדגמה אזהרתית של איך שימוש ב-mutable objects כ-keys ב-HashMap שובר חיפושים בשקט, והכלל הפשוט שמונע זאת."
images:
  featured_image: "/images/blog/covers/break-hashmap-less-than-a-minute.jpg"
---

> **TL;DR:** אף פעם אל תשתמשו באובייקטים mutable כמפתחות ב-HashMap!

אחרי שכתבתי את המאמר [**How does HashMap work in Java?**](https://yonatankarp.com/how-does-hashmap-work-in-java), כמה אנשים הציעו נושאים נוספים הקשורים ל-HashMap. בגלל זה החלטתי ליצור סדרה קצרה של מאמרים על הנושא.

במאמר של היום נדבר על JVM HashMaps ועל איך קל לשבור אותם אם לא משתמשים בהם בזהירות. חשוב לציין שלמרות שנתמקד בעולם ה-JVM, אותם עקרונות חלים על רוב שפות התכנות המודרניות.

במאמר הזה אני אספק מימוש ב-Java ואסביר את שורש הבעיה. אני גם אציע פתרונות לבעיות שאני מציג.

## ה-איך

בואו נסתכל על הקלאס הפשוט הבא. הוא עוטף ערך integer בתוך אובייקט ומספק מתודות לקריאה ושינוי של הערך:

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

עכשיו בואו נשתמש בקלאס שלנו ונוסיף אותו ל-`HashMap`:

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

מה יודפס כאן? אם הניחשתם `Sorry, nobody is home :(`, אתם צודקים. אבל למה?

## ה-למה

הבעיה היא בשימוש בקלאס mutable כמפתח ב-HashMap ואז שינויו לאחר מכן. כפי שציינתי במאמר הקודם, כשמוסיפים זוג key/value חדש ל-HashMap, ה-hash code של המפתח מחושב, והזוג נשמר ב-bucket הרלוונטי:

![](/images/blog/001-hashmap-insert-object.png)

אבל במקרה שלנו, שינינו את הערך של הקלאס. אז כשמחשבים את ה-hash code של האובייקט המעודכן, הוא כנראה יגיע ל-bucket אחר. כתוצאה מזה, כשה-HashMap בודק את ה-bucket, הוא לא ימצא את האובייקט הנדרש!

![](/images/blog/medium-1*-ehInn6beG7s3ry6JnqOBQ.png)

## אפשר להימנע מהבעיה?

![](/images/blog/004-avoid-at-all-cost.jpeg)

כן, אפשר! כדי להימנע מהבעיה, צריך להשתמש בקלאס immutable במקום mutable. זה אומר שברגע שהקלאס יוצר את ה-state שלו, אי אפשר לשנות אותו.

בואו נתחיל עם מימוש Java פשוט לקלאס:

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

כפי שניתן לראות במימוש הזה, הערך של הקלאס יכול להיות מוגדר רק דרך הקונסטרקטור, מה שמבטיח שלא ישתנה אחר כך. על ידי סימון השדה כ-`final`, אנחנו מבטיחים שלא ניתן לשנותו בזמן ריצה, אפילו באמצעות [reflection](https://www.oracle.com/technical-resources/articles/java/javareflection.html). זה הופך את הקלאס שלנו לאמיתי immutable.

## אפשר לעשות אפילו טוב יותר?

הקוד עכשיו עובד כמו שצריך. אבל הוא עדיין די verbose. למרבה המזל, החל מ-Java 14 יש לנו פיצ'ר שפה חדש (שהפך רשמי ב-Java 16) שנקרא **Records**.

מה זה records?

> JDK 14 introduces records, which are a new kind of type declaration. Like an `enum`, a record is a restricted form of a class. It's ideal for "plain data carriers," classes that contain data not meant to be altered and only the most fundamental methods such as constructors and accessors.

מה זה אומר? על ידי הגדרת קלאס כ-record, אנחנו מקבלים אוטומטית את המתודות הבאות:

* קונסטרקטור שמקצה את כל הקלטים לחברי הקלאס.

* Getters לכל חברי הקלאס, עם שדות private final מתאימים.

* מימוש `toString()` שנוצר אוטומטית.

* מתודות `hashCode()` ו-`equals()`.

אם רוצים ללמוד יותר על records ושימוש בהם, כדאי לבדוק את [הדוקומנטציה הרשמית של Oracle](https://docs.oracle.com/en/java/javase/14/language/records.html).

אז בואו ננסה:

```java
public record IntWrapper(int value) {
}
```

כפי שניתן לראות, הקוד שלנו הרבה יותר פשוט עכשיו. אם ננסה לחזור על שינוי ה-map מלפני, נקבל שגיאת קומפילציה:

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

אם אתם משתמשים בגרסה ישנה יותר של Java, אפשר עדיין להשיג את הפונקציונליות הזו עם [Project Lombok](https://projectlombok.org/) על ידי שימוש ב-annotation `@Value`. פרטים נוספים זמינים [כאן](https://projectlombok.org/features/Value).

# סיכום

![](/images/blog/002-hashmap-object-mutation.png)

בכל פעם שאתם משתמשים ב-HashMap (ב-Java או בכל שפה אחרת), ודאו שאתם משתמשים באובייקטים immutable כמפתחות. אחרת, זה עלול להוביל להתנהגות לא צפויה בקוד שלכם בזמן הריצה.
