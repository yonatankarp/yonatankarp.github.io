---
title: "XKCD: מטאיל לתמונה - לראות את התמונה המלאה"
date: 2024-06-26T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - xkcd
  - image-processing
  - hacking
categories:
  - Backend
  - Hacking
translationKey: "xkcd-from-tile-to-picture"
---

## מבוא

אם יש דבר אחד שאני יכול לומר על עצמי, זה שאני אוהב אתגרים שקשורים לתכנות. הם לא חייבים להיות משמעותיים או אפילו שימושיים, אבל אני נהנה מהאתגר. לכן כשראיתי את ההודעה הזו ב-LinkedIn שלי, הייתי חייב לקחת על עצמי את האתגר!

![](/images/blog/kb-linkedin-message-1024x685.png)

אם אתם לא מכירים את XKCD, הנה מה שויקיפדיה אומרת עליו:

> xkcd, sometimes styled XKCD, is a webcomic created in 2005 by American author Randall Munroe. The comic's tagline describes it as "a webcomic of romance, sarcasm, math, and language". Munroe states on the comic's website that the name of the comic is not an initialism but "just a word with no phonetic pronunciation".
>
> The subject matter of the comic varies from statements on life and love to mathematical, programming, and scientific in-jokes. Some strips feature simple humor or pop-culture references. It has a cast of stick figures, and the comic occasionally features landscapes, graphs, charts, and intricate mathematical patterns such as fractals.
> Wikipedia

מעולם לא ראיתי את הקומיקס הספציפי הזה (ראו [https://xkcd.com/1110](https://xkcd.com/1110)), אבל הייתי מוכן לאתגר. פתחתי את הקישור וגיליתי קומיקס פשוט בן 4 פריימים:

![](/images/blog/kb-xkcd-1110-1024x947.png)

הקאץ' הוא שהפריים האחרון למעשה אינטראקטיבי ומאפשר לקורא לנוע בתוכו:

![](/images/blog/kb-xkcd-110-animated.gif)

עם הידע הזה ביד, המשימה הייתה ברורה: להוריד את התמונה המלאה שנמצאת בפריים האחרון של הקומיקס!

## שלב 1: לנסות את הדרך הקלה

הניסיון הראשון לפתור את הבעיה היה לנסות את הדרך הקלה. בדקתי את ה-RSS feed של XKCD לקומיקס הספציפי הזה. לשם כך, השתמשתי בקישור [https://xkcd.com/1110/info.0.json](https://xkcd.com/1110/info.0.json).

התוצאה הייתה כדלקמן:

```
{
  "month": "9",
  "num": 1110,
  "link": "",
  "year": "2012",
  "news": "",
  "safe_title": "Click and Drag",
  "transcript": "[[A character is dangling from a balloon. All text appears in rectangular bubbles.]]\nCharacter: From the stories\nCharacter: I expected the world to be sad\nCharacter: And it was\n\nCharacter: And I expected it to be wonderful.\n\nCharacter: It was.\n\n((The last panel, unusually, is infinitely large, and this transcript is not wide enough to contain it. The part you can see in a normal browser window goes as follows.))\n[[ The same character is dangling above the ground, next to an intricately drawn tree with no leaves. ]]\nCharacter: I just didn't expect it to be so \nbig\n.\n\n{{Title text: Click and drag.}}",
  "alt": "Click and drag.",
  "img": "/images/blog/xkcd-click_and_drag.png",
  "title": "Click and Drag",
  "extra_parts": {
    "pre": "",
    "headerextra": "",
    "post": "\n\n\n\n",
    "imgAttr": ""
  },
  "day": "19"
}
```

אבל בדיקת ה-URL של התמונה הסתיימה בתוצאות מאכזבות מאוד:

![](/images/blog/xkcd-click_and_drag.png)

## שלב 2: הורדת התמונה

### מציאת גודל התמונה

כדי לנסות להבין איך להוריד את התמונה, הדבר הראשון שעשיתי היה לבדוק את קוד המקור של האתר, בתקווה שיעזור לי למצוא את התמונה המלאה.

בזמן בדיקת קוד המקור, מצאתי קטע קוד מעניין מאוד:

![](/images/blog/kb-tiles-change-1024x327.gif)

הסתכלות מקרוב על הקוד חשפה כמה תובנות מעניינות:

```

    
    ![](http://imgs.xkcd.com/clickdrag/2n1w.png)
    ![](http://imgs.xkcd.com/clickdrag/1n1w.png)
    ![](http://imgs.xkcd.com/clickdrag/2n2w.png)
    ![](http://imgs.xkcd.com/clickdrag/1n2w.png)
    ![](http://imgs.xkcd.com/clickdrag/2n3w.png)
    ![](http://imgs.xkcd.com/clickdrag/1n3w.png)
    ![](http://imgs.xkcd.com/clickdrag/3n3w.png)
    ...

```

חלק זה בקוד עודכן בכל פעם שזזתי על המפה והגעתי לסוף טאיל בפריים. אחרי שניסיתי עם זה קצת, יכולתי לראות pattern ברור בשמות הקבצים. הם מכילים מספר ואחריו האות **n** (לצפון) או **s** (לדרום), שמציין האם התמונה נמצאת מעל או מתחת לקו המרכזי של התמונה, ואז מספר נוסף והאות **w** (למערב) או **e** (למזרח).

לדוגמה, התמונה `1n2w.png` נמצאת בשורה המרכזית של התמונה, שני טאיילים לשמאל. זו הייתה גילוי נהדר! עכשיו אוכל לנסות לראות את גבולות התמונה על ידי קריאה לשרת ובדיקת התוצאות.

אחרי כמה ניסויים, גיליתי שהטאיל המרבי הזמין לצד ימין הוא 48 ([http://imgs.xkcd.com/clickdrag/1n48e.png](http://imgs.xkcd.com/clickdrag/1n48e.png)), והטאיל המרבי לצד שמאל הוא 33 ([http://imgs.xkcd.com/clickdrag/1n33w.png](http://imgs.xkcd.com/clickdrag/1n33w.png)) — וואו, זו תמונה גדולה!

לגבי גובה התמונה, זה היה אתגר גדול הרבה יותר. כנראה שטאיילים שאינם מכילים תמונה לא מאוחסנים בשרת ומרונדרים כצבע בדפדפן. זה אומר שלחלק עמודות עשויים להיות 5 טאיילים, בעוד שלאחרות 20. יתרה מזאת, בתיאוריה, יכולות להיות "איים" של טאיילים שאינם מחוברים לשום דבר אלא לעצמם. ראו את התמונה למטה כדוגמה:

![](/images/blog/kb-islands-1024x177.png)

אז מה עושים?

כשיש ספק, brute force תמיד פתרון טוב! מאחר שמספר הטאיילים (כנראה) אינו גדול מדי, אוכל להקדיש כמות סבירה וסופית של זמן לניסיון להוריד טאיל, ואם הוא לא שם, להמשיך לבא. לצורך המשימה הזו, החלטתי לנסות להוריד מטריצת טאיילים של `50x50`.

### הורדת הטאיילים

בשלב הזה התחלתי להיות עצלן. ביקשתי מחבר הטוב שלי ChatGPT לעזור לי וליצור קוד שיוריד את הטאיילים בשבילי באמצעות Kotlin. הקוד היה די מכוער, אבל אם אתם סקרנים, ניתן למצוא את התוצאות הסופיות ב-GitHub בסוף המאמר.

כרגיל, היה עלי לשנות את הקוד ולהוסיף הגנה למקרה שטאיל לא קיים כדי שהקוד לא יקרוס. הבעיה הייתה שהורדת הטאיילים לקחה יותר מדי זמן, והייתי להוט להמשיך לחלק הבא.

מה אפשר לעשות? ובכן, אפשר למנף את כוח ה-parallelism, ובהקשר שלנו, את ה-coroutines של Kotlin!

במקום לנסות לשלוף את כל המטריצה ב-thread אחד, חילקתי אותה לארבעה מקטעים שווים והתחלתי להוריד את הטאיילים של כל מקטע:

```
launch(Dispatchers.IO) {
    launch { fetcher.repeatInDirection(latitude = "n", longitude = "w") }
    launch { fetcher.repeatInDirection(latitude = "n", longitude = "e") }
    launch { fetcher.repeatInDirection(latitude = "s", longitude = "w") }
    launch { fetcher.repeatInDirection(latitude = "s", longitude = "e") }
}
```

כמה דקות חלפו, והיו לי כל 160 הטאיילים על המחשב. הצלחה! 🎉

### בניית התמונה מהטאיילים

החלק הבא היה קצת יותר מאתגר: לקחת את הטאיילים השונים ולשלב אותם לתמונה גדולה אחת. קודם, זה דרש מיקום כל אחד מהטאיילים במיקומו בתמונה הסופית. שוב, בהיותי מהנדס תוכנה עצלן, ביקשתי מ-ChatGPT לייצר עבורי קוד שיבנה את התמונה מהקבצים האלה על בסיס קידוד שם הקובץ.

הרצת הקוד שנתן ChatGPT הסתיימה בדיוק באותן תוצאות שפתחתי בהן את המאמר הזה — הספרייה שהשתמשתי בה (`BufferedImage` מ-awt) זרקה את החריגה הבאה:

```
Exception in thread "main" java.lang.IllegalArgumentException: Dimensions (width=165888 height=28672) are too large
	at java.desktop/java.awt.image.SampleModel.(SampleModel.java:131)
	at java.desktop/java.awt.image.SinglePixelPackedSampleModel.(SinglePixelPackedSampleModel.java:144)
	at java.desktop/java.awt.image.Raster.createPackedRaster(Raster.java:914)
	at java.desktop/java.awt.image.Raster.createPackedRaster(Raster.java:546)
	at java.desktop/java.awt.image.DirectColorModel.createCompatibleWritableRaster(DirectColorModel.java:1032)
	at java.desktop/java.awt.image.BufferedImage.(BufferedImage.java:324)
	at com.yonatankarp.xkcd.clickanddrag.Combiner.combineAll(Combiner.kt:40)
	at com.yonatankarp.xkcd.clickanddrag.MainKt.main(Main.kt:61)
```

הסתכלות על ה-codebase של הספרייה, הבעיה הייתה ברורה:

```
if (size > Integer.MAX_VALUE) {
    throw new IllegalArgumentException("Dimensions (width=" + w + " height=" + h + ") are too large");
}
```

אכן, לתמונה היו יותר מדי פיקסלים. הדבר הראשון שעשיתי לתיקון הבעיה היה לשנות גודל את התמונה הסופית. במקום להשתמש בגודל הטאיל המקורי (`2048x2048`), שינתי גודל ב-4 לגודל של `512x512`, מה שהביא לקובץ הזה:

![](/images/blog/kb-512x512-white-1024x177.png)

עכשיו יכולתי מיד להבחין בבאג: טאיילים שנמצאים מתחת למרכז התמונה היו צריכים להיות בצבע שחור, בעוד שטאיילים שנמצאים מעל המרכז היו צריכים להיות לבנים, מה שגרם לתמונה מוזרה. אחרי תיקון מהיר, סוף סוף קיבלתי את התמונה הזו (לא לפני שהפכתי את הצבעים, כמובן):

![](/images/blog/kb-512x512-fixed-1-1024x177.png)

הידד! עם זאת, הגדלה של התמונה הביאה לתוצאות מפוקסלות ובלתי קריאות. המשימה עדיין לא הושלמה.

### פריסת העוגה

חיפשתי ב-Google זמן מה, אבל כל תוצאה שראיתי הצביעה על מגבלה כלשהי על גודל התמונה, שנגרמה מכך שעיבוד התמונה נעשה בזיכרון עבור כל הספריות. פניתי ל-Reddit ול-LinkedIn אבל ללא תוצאה טובה.

כדי לפתור את הבעיה, הוספתי תיקון נוסף לתוכנית: כל שורה בתמונה נוצרה כקובץ PNG נפרד, ותקוותי הייתה להשתמש בתוכנת עריכת גרפיקה כמו Gimp לשלב אותן חזרה לתמונה גדולה אחת.

עם סבלנות רבה ויותר מ-50GB של זיכרון ששימש לשילוב כל התמונות, בסוף הצלחתי לבנות את התמונה! הצלחה גדולה!

סיימתי את היום מאושר והלכתי לישון. 💪

### הבאג

בבוקר שלמחרת, החלטתי להסתכל על תמונת הפלט ולסוף לקרוא את כל התמונה. לא לקח יותר מ-30 שניות כדי למצוא באג בתוצאות. בין הטאיילים `1n1e` ל-`1n1w` היה רווח של טאיל אחד שלא היה צריך להיות שם:

![](/images/blog/kb-bug.png)

התיקון היה פשוט מאוד, אבל לא רציתי לבלות עוד 30 דקות בשילוב 14 פרוסות של תמונות. כדי למזער את הכאב, כל מה שהיה עלי לחשב הוא מספר השורות המרבי שיכול להתאים בתוך גודל `MAX_INT` פיקסלים. חישוב מהיר הראה שמספר השורות שיכולות להתאים הוא 3 (167,936 x 2048 * 3), מה שגרם לרק 5 חתיכות לשלב יחד.

הרצתי שוב את הקוד, שילבתי את כל החתיכות ושמחתי לייצא את הקובץ כ-PNG בגודל של ~30MB.

## שלב 3: שיתוף התוצאות

רציתי לשתף את התוצאות עם אנשים, אבל התמונה פשוט הייתה גדולה מדי מכדי להעלות. כדי לפתור את הבעיה הזו, החלטתי ליצור repository חדש לאחסון תמונת התוצאה הסופית, תמונת Gimp הביניים וכל הטאיילים, כולל כל קוד המקור שנשתמש בו במהלך פרויקט ה-hacking הזה, ב-GitHub.

אם רוצים לבדוק, בקרו ב-[GitHub Repository](https://github.com/yonatankarp/xkcd-click-and-drag). אם אהבתם, תנו לו ⭐️!

## סיכום

לקיחת האתגר של הורדה ובנייה מחדש של הקומיקס "Click and Drag" המלא מ-XKCD הייתה חוויה מתגמלת וחינוכית. דרך התמדה ופתרון יצירתי של בעיות, התגברתי על מכשולים טכניים שונים ולמדתי לקחים יקרי ערך על עיבוד תמונות בקנה מידה גדול וכוח המחשוב המקבילי.

הפרויקט הזה מדגיש את החשיבות של חשיבה מחוץ לקופסה ואי-התחמקות ממשימות שנראות מפחידות. הסיפוק מהתגברות על כל מכשול וראיית התמונה המלאה הסופית היה מספק מאוד. זה מהווה תזכורת שאפילו הבעיות המורכבות ביותר יכולות להיפתר בשילוב של סקרנות, תושייה והתמדה.

אני מעודד אתכם לקחת על עצמכם את האתגרים שלכם, בין אם הם בתכנות או בתחום אחר. אמצו את תהליך הלמידה, בקשו עזרה כשצריך, ובעיקר, תהנו מהדרך. בסופו של דבר, הפתרונות הטובים ביותר מגיעים לעיתים קרובות פשוט מהנאה ודחיפת הגבולות של מה שאתם חושבים שאפשרי.

תודה שעקבתם אחרי ההרפתקה שלי. אם אתם מעוניינים בפרטים או רוצים לנסות בעצמכם, אתם מוזמנים לבקר ב-GitHub repository ולחקור עוד. Happy coding!

## קרדיטים

- צילומים מאת [GR Stocks](https://unsplash.com/@grstocks) ב-[Unsplash](https://unsplash.com/).
