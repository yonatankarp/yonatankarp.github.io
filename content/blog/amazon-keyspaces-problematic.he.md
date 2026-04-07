---
title: "4 סיבות למה Amazon Keyspaces בעייתי!"
date: 2021-12-30T00:00:00+01:00
draft: false
type: "blog"
tags:
  - aws
  - cassandra
  - amazon-keyspaces
  - databases
  - cloud
categories:
  - Backend
  - Cloud
translationKey: "amazon-keyspaces-problematic"
---

לפני בערך שנה, הצוות שלי ואני קיבלנו משימה לבנות מערכת עם ביצועים גבוהים שמסוגלת להתמודד עם נפח בקשות גדול. אחרי שחשבנו על זה טוב, בחרנו ב-Cassandra כמסד הנתונים שלנו.

כשהגיע הזמן להוציא את המערכת לפרודקשן, בדקנו שלוש אפשרויות עיקריות:

* [**Self-hosted Cassandra**](https://cassandra.apache.org/_/index.html): פסלנו את זה בגלל הצורך בתחזוקת חומרה.

* [**DataStax**](https://www.datastax.com/): ה-"Confluence-Kafka" של Cassandra — מימוש מלא בענן שמנוהל על ידי צוות DataStax.

* [**Amazon Keyspaces**](https://aws.amazon.com/keyspaces/): הגרסה של אמזון לשפת CQL של Cassandra.

בגלל שאנחנו משתמשים הרבה ב-AWS, בחרנו ב-Amazon Keyspaces, תוך התחשבות בתמיכה הקיימת ב-AWS ובמחיר התחרותי.

אבל מה שלא ידענו זה ש-Amazon Keyspaces תומך רק בערך ב-40% מהפיצ'רים של Cassandra בזמן כתיבת המאמר הזה. אפשר לראות [כאן](https://docs.aws.amazon.com/keyspaces/latest/devguide/cassandra-apis.html) סקירה עדכנית של הפיצ'רים הנתמכים.

בואו נדבר על הפיצ'רים החסרים העיקריים שנתקלנו בהם ועל הפתרונות שמצאנו.

## 1\. UDT's (User Defined Types)

Cassandra מאפשר למשתמשים להגדיר טיפוסי נתונים מותאמים אישית, מה שמאפשר יצירת עמודות במסד הנתונים שתואמות בדיוק לנתונים הנדרשים. הפיצ'ר הזה מבטיח שהמודלים במסד הנתונים משקפים במדויק את המודלים ברמת השירות.

מצאנו שתי חלופות לטפל בבעיה:

* קונבנציית שמות עמודות ספציפיות למודל: לדוגמה, אם יש לנו מודל `Person` עם תכונות `id` ו-`name`, ניצור שתי עמודות במסד הנתונים: `person_id` ו-`person_name`.

* שימוש ב-tuples לאחסון נתונים בעמודה אחת: לחלופין, אפשר ליצור עמודה אחת `person` עם הטיפוס `tuple<int, string>`.

לשני הפתרונות יש חסרונות. האפשרות הראשונה מאפשרת הבנה קלה של הטיפוס של כל שדה אבל קשה יותר לדמיין את המודל בכללותו כי הוא פרוס על פני כמה עמודות. האפשרות השנייה נותנת תמונה כוללת של המודל אבל קשה יותר להבין כל שדה בנפרד. לכן השתמשנו בשתי הגישות בהתאם למקרה השימוש. לדוגמה, כשמאחסנים מחיר שמורכב מסכום ומטבע, הגיוני להשתמש ב-tuple כי הם קשורים זה לזה ואין להם משמעות בנפרד. אבל בדוגמה של `person`, קל יותר להבין כל שדה בנפרד.

## 2\. TTL (Time To Live)

Cassandra תומך ב-TTL, שמאפשר הסרה אוטומטית של שורות ממסד הנתונים אחרי זמן מוגדר מראש. תכננו להשתמש בפיצ'ר הזה לאחסון ותחזוקה של מפתחות idempotency לבקשות. אבל הִיעדרו של הפיצ'ר הזה גרם לשורות חסרות תועלת רבות שנשארו במסד הנתונים לפחות 12 שעות.

כדי לטפל בבעיה, החלטנו לאחסן את המפתחות שלנו מחוץ למסד הנתונים ב-[Redis](https://redis.io/) cluster. אפשרות נוספת הייתה לממש scheduled job לניקוי מסד הנתונים, אבל זה היה מוסיף עומס מיותר.

על צד חיובי, מנהל חשבון ה-AWS שלנו עדכן אותנו שהפיצ'ר הזה אמור להיות זמין בתחילת 2023! 🎉

## 3\. Syntax

למרות שכל הפיצ'רים ב-Amazon Keyspaces תואמים ל-Cassandra, ההפך אינו נכון. במהלך הפיתוח גילינו שפיצ'רים מסוימים כמו `in` ו-`not equals` עדיין לא נתמכים במסד הנתונים.

לצערנו, לעיתים קרובות לא מצאנו חלופות מתאימות לפיצ'רים האלה, מה שהוביל לקוורי סאב-אופטימליים. בנוסף, גילינו שכל מבני הנתונים ב-Keyspaces חייבים להיות immutable (כלומר `frozen`), בניגוד ל-Cassandra. לדוגמה, במקרה של מודל ה-`person` שלנו, ה-`tuple` יצטרך להיות מוגדר כך ב-Keyspaces:

```kotlin
frozen<tuple<int, string>>
```

כדי לא לשבש את ה-clusters שלנו, יצרנו instance נפרד של Keyspaces לצרכי CI. זה אפשר לנו להריץ סקריפטים ולוודא שהם עובדים כמצופה (או שהם בכלל עובדים במקרים מסוימים).

## 4\. Materialized Views

לפי הדוקומנטציה של Cassandra:

> Each such view is a set of rows that corresponds to rows that are present in the underlying, or base, table specified in the SELECT statement. A materialized view cannot be directly updated, but updates to the base table will cause corresponding updates in the view.

הִיעדרו של הפיצ'ר הזה היה מכשול משמעותי לאורך כל תהליך הפיתוח שלנו. כדי להתגבר על זה, יצרנו טבלה ממשית לאחסון הנתונים ועדכון הרשומות. אבל כיוון שכל שורה ב-Cassandra היא internally immutable, עדכון שורות הופך לפעולה יקרה יותר במשאבים, מה שפוגע בביצועים.
