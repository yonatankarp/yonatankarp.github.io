---
title: "Build your own Twitter Bot with Kotlin"
date: 2021-12-15T00:00:00+01:00
draft: false
type: "blog"
featured: true
tags:
  - kotlin
  - twitter
  - bot
  - twitter4j
categories:
  - Backend
  - Kotlin
translationKey: "build-twitter-bot-kotlin"
images:
  featured_image: "/images/blog/covers/build-twitter-bot-kotlin.jpg"
---

I read an excellent article by [Martin Erlic](https://medium.com/u/f864d52751a7) called "[How To Make a Scary Russian Twitter Bot With Java](https://medium.com/@SeloSlav/how-to-make-a-scary-russian-twitter-bot-with-java-b7b62768a3ac)" and I wanted to update it using Kotlin.

Unlike the original article, I will use Kotlin, a newer and more modern JVM-based language, and Gradle as the build system.

To build the bot, follow these simple steps:

### Step 1 — Create a Twitter Application

The first step is to create a [Twitter Application](https://apps.twitter.com/) using the user account you want to perform the API requests with. By creating the Twitter application, you will obtain the API key and API secret, which we'll later use to authenticate our bot with Twitter.

1. Go to the dashboard and click on "Create App". Choose a unique name for your bot.
    
    ![name your app](/images/blog/hashnode-e4DDWaddA.png)
    

![get account keys](/images/blog/hashnode-iotlNGKrr.png)

2\. Change the token access from `Read only` to `Read and Write` in the dashboard.

![change access to read & write](/images/blog/hashnode-DJ_XtxBF4.png)

3\. Create the access token and access secret.

![create access keys](/images/blog/hashnode-JeHY2mZsT.png)

4\. Remember to store all the keys as we'll need them in Step 4!

### Step 2 — Clone the Project Starter from GitHub

To save you time setting up the project, I've created a starter version on GitHub that contains all the necessary setups. You can clone it from [https://github.com/yonatankarp/twitter-bot](https://github.com/yonatankarp/twitter-bot). You can use IntelliJ Community Edition or other tools like Visual Studio Code.

### Step 3 — Prepare Tweets and Configure Twitter4J

In the **resources** directory, open the **tweets.txt** file. This file will contain the tweets that our bot will publish. Each tweet should be on a separate line. Aim for at least 100 unique tweets to reduce the chances of content detection. Remember the 280 character limit imposed by Twitter.

Open the [**twitter4j.properties**](http://twitter4j.properties) file in the same resources directory. Fill in the following information from **Step 1**:

```text
debug=true  
oauth.consumerKey=  
oauth.consumerSecret=  
oauth.accessToken=  
oauth.accessTokenSecret=
```

With the authentication set, we can move on to the code!

### Step 4 — The Code

Create a new Kotlin file called `TwitterBot.kt` in the `src/main/kotlin` directory. Replace the existing code with the following:

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

The code above is relatively simple and well-documented to ensure ease of understanding.

As mentioned in the original article, make sure to familiarize yourself with the [Twitter API Limits](https://help.twitter.com/en/rules-and-policies/twitter-limits) to understand the frequency of tweeting without encountering issues.

### Step 5 — Running the Application

You can run the program from the command line in the project directory using the following command:

```shell
./gradlew clean build && java -jar ./build/libs/twitter-bot-1.0-SNAPSHOT.jar
```

If everything is successful, you should see the following output in your debug terminal:

![bot output](/images/blog/hashnode-_IXLpBWjd.png)

Congratulations! Your bot is now functional!


The completed bot is available in the repository mentioned in Step 2, under the branch name `complete_bot` at [https://github.com/yonatankarp/twitter-bot/tree/complete\_bot](https://github.com/yonatankarp/twitter-bot/tree/complete_bot).
