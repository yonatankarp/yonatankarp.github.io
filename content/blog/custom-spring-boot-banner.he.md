---
title: "יצירת Spring Boot App Banner מותאם אישית"
date: 2022-12-02T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - spring-boot
  - customization
categories:
  - Backend
  - Kotlin
translationKey: "custom-spring-boot-banner"
description: "מדריך כיפי להחלפת banner ברירת המחדל של Spring Boot בטקסט מותאם אישית ו-ASCII art."
images:
  featured_image: "/images/blog/covers/custom-spring-boot-banner.jpg"
---

היום אני רוצה לשתף אתכם בפיצ'ר כיפי של Spring. הוא לא חדש או קריטי, אבל הוא בהחלט מהנה!

בדרך כלל, כשמפעילים את אפליקציית Spring Boot, רואים banner סטנדרטי ב-logs כזה:

![Spring Boot Banner](/images/blog/medium-1*qhCPGhoCfVHDiV_8C2w-IQ.png)

אבל האם אי פעם חשבתם להחליף את ה-Spring banner ב-banner מותאם אישית? אם כן, המאמר הזה בשבילכם!

כדי להתחיל, בואו נגש ל-[https://patorjk.com/](https://patorjk.com/) — אתר שעוזר לנו ליצור טקסט מותאם אישית. אפשר להכניס את הטקסט הרצוי ל-log ולבחור מתוך מגוון גופנים. לדוגמה:

![Custom Text](/images/blog/medium-1*C4UCtmMxeYdyA3adBhwwEg.png)

אפשר גם ללחוץ על כפתור **Test All** כדי לבדוק את כל האפשרויות הזמינות.

עכשיו בואו נעתיק את הטקסט שלנו ונשים אותו באפליקציה תחת `/resources/banner.txt`, כמו שרואים כאן:

![Copy Custom Text](/images/blog/medium-1*e0zWvbSOc4-txfoe9I1Q5Q.png)

עכשיו נפעיל מחדש את האפליקציה:

![Custom Banner](/images/blog/medium-1*Nm-03wgAZnZGCV-Z2WBmFQ.png)

כפי שניתן לראות, ה-banner המותאם אישית שלנו הוחלף בהצלחה! עבודה טובה! :)

אם אתם משתמשים ב-Spring Boot 2, אפשר אפילו להמיר תמונות ל-[ASCII art](https://en.wikipedia.org/wiki/ASCII_art). שימו לב שהפונקציונליות הזו deprecated ו-Spring Boot `3.0.0` שיצא לאחרונה הסיר אותה.

כדי להמיר תמונות ל-ASCII art, עקבו אחרי השלבים האלה:

* הוסיפו את התמונה לתיקיית resources. לצורך המאמר הזה, נשתמש בלוגו הבא:

![Logo](/images/blog/medium-1*nF3paal9R_NCqIpeMEg_lA.png)

* הוסיפו את ההגדרה הבאה לקובץ [`application.properties`](http://application.properties) או `application.yml` שלכם כדי לציין את מיקום התמונה:

```yaml
spring:
  banner:
    image:
      location: sumup.png
      height: 20 # can be adjusted to resize your banner
```

* ודאו שאין קובץ `banner.txt` בתיקיית resources.

בואו נריץ את האפליקציה שוב...

![Custom Logo](/images/blog/medium-1*Se9si_zINQyzFsUTQTmvSg.png)

כפי שניתן לראות, הלוגו החדש שלנו מופיע!

### סיכום

במאמר הקצר הזה, הראיתי לכם איך להתאים אישית את ה-Spring banner שלכם באמצעות טקסט או אפילו תמונות (ל-Spring Boot `2.x.x`) תוך כמה דקות.
