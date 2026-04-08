---
title: "4 Reasons Why Amazon Keyspaces is Problematic!"
date: 2021-12-30T00:00:00+01:00
draft: false
type: "blog"
description: "Four concrete production problems the author encountered with Amazon Keyspaces (managed Cassandra), and why the service may not be ready for every workload."
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
images:
  featured_image: "/images/blog/covers/amazon-keyspaces-problematic.jpg"
---

Around a year ago, my team and I were tasked with building a high-performance system capable of handling a large volume of requests. After careful consideration, we chose Cassandra as our database.

<!--more-->

When it came to productizing our system, we explored three main options:

* [**Self-hosted Cassandra**](https://cassandra.apache.org/_/index.html): We ruled this out due to the need for hardware maintenance.
    
* [**DataStax**](https://www.datastax.com/): Dubbed the "Confluence-Kafka" of Cassandra, it offers a fully cloud-based implementation managed by the DataStax team.
    
* [**Amazon Keyspaces**](https://aws.amazon.com/keyspaces/): Amazon's version of Cassandra's CQL language.
    

Given our heavy use of AWS, we opted for Amazon Keyspaces, taking into account the existing AWS support and competitive pricing.

However, little did we know that Amazon Keyspaces only supports about 40% of the features offered by Cassandra at the time of writing this article. You can refer to [this](https://docs.aws.amazon.com/keyspaces/latest/devguide/cassandra-apis.html) link for an up-to-date overview of the supported features.

Let's discuss the key missing features we encountered and the workarounds we implemented to address them.

## 1\. UDT's (User Defined Types)

Cassandra allows users to define custom data types, enabling the creation of columns in the database that precisely match the required data. This feature ensures that the database models accurately reflect the service level models.

We discovered two alternatives to address this issue:

* Model-specific column naming convention: For instance, assuming we have a `Person` model with `id` and `name` properties, we create two columns in the database: `person_id` and `person_name`.
    
* Using tuples to store data in a single column: Alternatively, we can create a single column `person` with the type `tuple<int, string>`.
    

Both solutions have drawbacks. The first option allows easy understanding of each field's type but makes it harder to visualize the overall model since it spans multiple columns. The second option provides a holistic view of the model but makes it challenging to understand each field in isolation. Consequently, we employed both approaches based on the specific use case. For example, when storing a price, consisting of an amount and a currency, it makes sense to use a tuple since they are inherently linked and lack individual meaning. However, for the `person` example, it is easier to comprehend each field independently.

## 2\. TTL (Time To Live)

Cassandra supports TTL, allowing rows to be automatically removed from the database after a predefined time. We planned to leverage this feature to store and maintain our idempotency keys for requests. However, the absence of this feature resulted in numerous useless rows that persisted in the database for at least 12 hours.

To address this issue, we decided to store our keys outside the database in a [Redis](https://redis.io/) cluster. Another option would be to implement a scheduled job to clean the database, but this would introduce unnecessary additional load.

On a positive note, our AWS account manager informed us that this feature is expected to be available in early 2023! 🎉

## 3\. Syntax

While all features in Amazon Keyspaces are compatible with Cassandra, the reverse is not true. During development, we discovered that certain features like `in` and `not equals` were not yet supported by the database.

Unfortunately, we often couldn't find suitable replacements for these features, resulting in suboptimal queries. Additionally, we learned that all data structures in Keyspaces must be immutable (`frozen`), unlike Cassandra. For example, in the case of our `person` model, the `tuple` representation would need to be defined as follows in Keyspaces:

```kotlin
frozen<tuple<int, string>>
```

To avoid disrupting our clusters, we created a separate Keyspaces instance for Continuous Integration (CI) purposes. This allowed us to run scripts and validate their functionality, ensuring they worked as expected (or worked at all in some cases).

## 4\. Materialized Views

As per Cassandra's documentation:

> Each such view is a set of rows that corresponds to rows that are present in the underlying, or base, table specified in the SELECT statement. A materialized view cannot be directly updated, but updates to the base table will cause corresponding updates in the view.

The absence of this feature proved to be a significant hurdle throughout our development process. To overcome it, we ended up creating an actual table to store the data and update the entries. However, as each row in Cassandra is internally immutable, updating rows becomes a more resource-intensive operation, negatively impacting performance.

