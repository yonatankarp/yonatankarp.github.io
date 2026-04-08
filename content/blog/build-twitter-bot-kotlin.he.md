---
title: "בנו Twitter Bot משלכם עם Kotlin"
date: 2021-12-15T00:00:00+01:00
draft: false
type: "blog"
tags:
  - kotlin
  - twitter
  - bot
  - twitter4j
categories:
  - Backend
  - Kotlin
translationKey: "build-twitter-bot-kotlin"
featured_image: "/images/blog/covers/build-twitter-bot-kotlin.jpg"
---

קראתי מאמר מצוין של [Martin Erlic](https://medium.com/u/f864d52751a7) בשם "[How To Make a Scary Russian Twitter Bot With Java](https://medium.com/@SeloSlav/how-to-make-a-scary-russian-twitter-bot-with-java-b7b62768a3ac)" ורציתי לעדכן אותו עם Kotlin.

בניגוד למאמר המקורי, אני אשתמש ב-Kotlin — שפת JVM חדשה ומודרנית יותר — ו-Gradle כמערכת ה-build.

כדי לבנות את ה-bot, עקבו אחרי השלבים הפשוטים האלה:

### שלב 1 — יצירת Twitter Application

השלב הראשון הוא ליצור [Twitter Application](https://apps.twitter.com/) עם חשבון המשתמש שאיתו רוצים לבצע את בקשות ה-API. על ידי יצירת ה-Twitter application, נקבל את ה-API key וה-API secret שבהם נשתמש מאוחר יותר לאימות ה-bot שלנו עם Twitter.

1. נכנסים לדשבורד ולוחצים על "Create App". בוחרים שם ייחודי ל-bot.

    ![name your app](/images/blog/hashnode-e4DDWaddA.png)

![get account keys](/images/blog/hashnode-iotlNGKrr.png)

2\. משנים את גישת ה-token מ-`Read only` ל-`Read and Write` בדשבורד.

![change access to read & write](/images/blog/hashnode-DJ_XtxBF4.png)

3\. יוצרים את ה-access token וה-access secret.

![create access keys](/images/blog/hashnode-JeHY2mZsT.png)

4\. חשוב לשמור את כל המפתחות כי נצטרך אותם בשלב 4!

### שלב 2 — שיכפול ה-Project Starter מ-GitHub

כדי לחסוך לכם זמן בהגדרת הפרויקט, יצרתי גרסת starter ב-GitHub שמכילה את כל ההגדרות הנדרשות. אפשר לשכפל אותה מ-[https://github.com/yonatankarp/twitter-bot](https://github.com/yonatankarp/twitter-bot). אפשר להשתמש ב-IntelliJ Community Edition או בכלים אחרים כמו Visual Studio Code.

### שלב 3 — הכנת Tweets והגדרת Twitter4J

בתיקיית **resources**, פותחים את הקובץ **tweets.txt**. הקובץ הזה יכיל את הציוצים שה-bot שלנו יפרסם. כל ציוץ צריך להיות בשורה נפרדת. כדאי לשאוף לפחות 100 ציוצים ייחודיים כדי להפחית את הסיכוי לזיהוי תוכן. זכרו את מגבלת 280 התווים שמטיל Twitter.

פותחים את הקובץ [**twitter4j.properties**](http://twitter4j.properties) באותה תיקיית resources. ממלאים את הפרטים הבאים מ**שלב 1**:

```text
debug=true  
oauth.consumerKey=  
oauth.consumerSecret=  
oauth.accessToken=  
oauth.accessTokenSecret=
```

עם האימות מוכן, אפשר לעבור לקוד!

### שלב 4 — הקוד

יוצרים קובץ Kotlin חדש בשם `TwitterBot.kt` בתיקיית `src/main/kotlin`. מחליפים את הקוד הקיים בקוד הבא:

![](/images/blog/hashnode-USq7hjFK9.png)

```kotlin
package com.example

import twitter4j.Status
import twitter4j.TwitterFactory

object TwitterBot {
    @JvmStatic
    fun main(args: Array<String>) {
        tweetAll()
    }

    /**
     * Reads all tweets from the `tweets.txt` file in the resources
     * directory and tweets them one by one with a delay between each.
     */
    private fun tweetAll() {
        val tweets = getResourceAsLines("tweets.txt")
        tweets.forEach { tweet ->
            sendTweet(tweet)
            println("Tweeting: $tweet...")
            waitUntilNextTweet()
        }
    }

    /**
     * Reads the content of a given file.
     *
     * @param resource the path under the resources directory
     *        to read from.
     * @return a list of strings representing each line in the file.
     */
    private fun getResourceAsLines(resource: String): List<String> =
        TwitterBot.javaClass.classLoader
            .getResource(resource)
            .readText()
            .lines()

    /**
     * Publishes a given tweet to the Twitter account.
     */
    private fun sendTweet(tweet: String) = kotlin.runCatching {
        TwitterFactory.getSingleton().updateStatus(tweet)
    }
        .onSuccess { status: Status -> println(status) }
        .onFailure { it.printStackTrace() }

    /**
     * Waits for a constant amount of time between every two
     * tweets to be published.
     *
     * @param delayInSeconds the number of minutes to delay,
     * 30 minutes by default.
     */
    private fun waitUntilNextTweet(delayInSeconds: Long = 30) =
        kotlin.runCatching {
            println("Sleeping for $delayInSeconds minutes...")
            // Change here to increase or decrease the delay.
            Thread.sleep(delayInSeconds * 60000)
        }
            .onFailure { it.printStackTrace() }
}
```

הקוד למעלה פשוט יחסית ומתועד היטב כדי להקל על ההבנה.

כמו שציין המאמר המקורי, כדאי להכיר את [מגבלות Twitter API](https://help.twitter.com/en/rules-and-policies/twitter-limits) כדי להבין מה תדירות הציוץ שאפשר לשמור עליה בלי לגרום לבעיות.

### שלב 5 — הרצת האפליקציה

אפשר להריץ את התוכנית משורת הפקודה בתיקיית הפרויקט עם הפקודה הבאה:

```shell
./gradlew clean build && java -jar ./build/libs/twitter-bot-1.0-SNAPSHOT.jar
```

אם הכל הצליח, אמורים לראות את הפלט הבא בטרמינל ה-debug:

![bot output](/images/blog/hashnode-_IXLpBWjd.png)

מזל טוב! ה-bot שלכם עובד עכשיו!

ה-bot המוגמר זמין ב-repository שהוזכר בשלב 2, תחת שם ה-branch `complete_bot` ב-[https://github.com/yonatankarp/twitter-bot/tree/complete\_bot](https://github.com/yonatankarp/twitter-bot/tree/complete_bot).
