---
title: "Real-Life Problem Solving: Lessons from My Engineering Principles"
date: 2023-03-05T00:00:00+01:00
draft: false
type: "blog"
tags:
  - engineering
  - software-engineering
  - best-practices
  - problem-solving
categories:
  - Engineering
---

My employer announced a few months ago that any employee who works for three years or more is entitled to a sabbatical. This sabbatical is a fully paid one-month vacation of your choice. Since my wife and I had accumulated a significant number of vacation days, we decided to embark on a two-month trip to Asia—a destination we had long desired to visit. In this post, I will describe step by step how I applied methods from my day-to-day work as a software engineer to solve real-life problems.

## Principle 1: Eventually, Something Will Break in Production

![Eventually, something will break](/images/blog/hashnode-c18a7372-0e12-4dca-83a9-050981c9752f.jpeg)

As the old saying goes, eventually, a production incident will occur. In our case, it happened sooner rather than later. Just a couple of hours after we landed in Thailand, we discovered a huge issue—both my wife's credit card and mine had expired on the day we arrived. This came as a big surprise to us since back home, credit card providers typically replace your card at least six months before its expiration date. However, living in Germany for almost four years taught us something new. Here, you need to request a new card from your bank if you want a replacement (lesson learned!). Fortunately, we had brought some cash with us for the vacation, so we were able to rely on that.

So, what did we do? We began by estimating the magnitude of the problem, determining the impact, exploring potential solutions, and assessing how quickly we needed to implement them. This discussion proved to be very useful. We concluded that by using Airbnb for bookings, we could save the cash we had with us. Additionally, we realized that we had enough cash to sustain us for a while, allowing us to proceed with our vacation.

Listing the possible solutions to our problem enabled us to:

* Understand the problem's scope.
    
* Grasp the complexity of potential solutions.
    
* Select the solution(s) that best suit our needs.
    

## Principle 2: Retro & Action Items

![person writing bucket list on book](https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80)

When planning our trip, my wife and I decided to book an Airbnb for five days to allow for sufficient time to recover from jetlag and explore the city. However, despite the fact that we did experience jetlag for about three to four days, we felt that we could have shortened our stay. Furthermore, while our Airbnb accommodation was decent, it wasn't exceptional and was slightly overpriced.

So, what did we do? As the title suggests, we conducted a short retrospective. During this discussion, we identified what we did well and what we could have done better. We agreed that blindly committing to a long-term stay was not a great idea. Moreover, what if we didn't like the destination we were heading to? Why should we commit to an extended period there?

The result of this retrospective was an action item that we implemented throughout our trip. We decided not to book any place for more than two nights initially. This approach gave us the flexibility to change hotels if we didn't like our accommodations or if we felt compelled to move on to our next destination.

This 10-15 minute discussion during the first week of our trip proved invaluable in terms of planning ahead and avoiding frustration later on. That's what I consider a good investment!

## Principle 3: Always Have Someone Checking Your Work

![person using laptop](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80)

At one point during our trip, we needed to book an internal flight. I found a suitable flight, although it wasn't on the ideal date—it was the closest option based on our location at the time. We made the booking, waited in our location for three days, and embarked on a six-hour boat ride. To our dismay, we discovered upon arrival that I had made a mistake and booked the flight for a month later.

While there were reasons behind the error, the outcome was the same—we found ourselves at the airport with no flight and no local currency (our second mistake).

So, what did we learn? Similar to code development, where seeking a review before merging is essential, we implemented the same approach for bookings of any kind (hotels, flights, buses, etc.). The other person would validate that all details were correct. We were surprised by the number of small issues we caught in each other's bookings throughout the trip.

## Principle 4: Requirements Change

![black and white wall mounted paper](https://images.unsplash.com/photo-1585064210818-8b7af20d03b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80)

When initially planning our trip, we intended to spend one month in Thailand and one month in the Philippines. However, during our stay in southern Thailand, we found the weather to be unbearably hot. My wife, who dislikes hot weather, and I discussed the situation and decided to look for a cooler destination. After careful consideration, we chose to shorten our stay in Thailand and add a third destination to our trip. That's how we ended up in Vietnam!

So, what did we learn? Nothing is set in stone. What initially seemed like a good fit could turn out to be a poor match. Always be open to changes based on the user's needs. We could have stubbornly stuck to our original plan, reasoning that everything was already set. However, by modifying our plan, we crafted a vacation that was better suited to our preferences.


## Conclusion

Applying practices from the engineering world to real-life problems can yield significant benefits. Many of our problems have already been solved in different contexts, and we can learn from those solutions to address our own needs.
