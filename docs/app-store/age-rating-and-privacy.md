# Age rating questionnaire and App Privacy answers

These answers are based on what the code does today (audited 2026-10-14).
App Store Connect calculates the actual rating from your answers.

## Age rating (App Store Connect → App Information → Age Rating)

Apple's current tiers are 4+, 9+, 13+, 16+ and 18+. Apple also added
in-app capability questions, including a social-media capability question
that is mandatory for submissions from September 2026 and sets a 13+ minimum.

| Question                                        | Recommended answer                                | Why                                                         |
| ----------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Parental controls                               | No                                                | None in the app                                             |
| Age assurance                                   | **Yes — self-declared, only for club organizers** | Date of birth is self-declared; it is not verified identity |
| Unrestricted web access                         | No                                                | No in-app browser to arbitrary sites                        |
| User-generated content                          | **Yes**                                           | Posts, comments, photos, listings, clubs                    |
| Messaging and chat                              | **Yes**                                           | Direct messages, club chats, activity chats                 |
| Social media (feed / discovery of user content) | **Yes**                                           | Neighborhood feed and Discover Neighbors                    |
| Advertising                                     | No                                                | No ads                                                      |
| Profanity or crude humor                        | None (filtered, prohibited)                       | Filtered and against guidelines                             |
| Sexual content / nudity                         | None                                              | Prohibited and reportable                                   |
| Violence (cartoon, realistic, graphic)          | None                                              | Prohibited                                                  |
| Horror / fear themes                            | None                                              | —                                                           |
| Alcohol, tobacco or drug use                    | None                                              | Prohibited listings                                         |
| Gambling / simulated gambling / contests        | None                                              | —                                                           |
| Medical or treatment information                | None                                              | —                                                           |
| Mature or suggestive themes                     | None                                              | —                                                           |

**Expected result:** at least 13+ because of the social-media capability.

**Recommendation: choose 16+ deliberately.** Haratna lets nearby strangers
message each other after connecting, meet in person at activities, and
trade items. The app's own rules already restrict clubs to adult
organizers. If App Store Connect produces 13+, you can still raise the rating
voluntarily ("set a higher age rating" option). This is a product and legal
decision for the owner. Do not describe the app as "for children".

## App Privacy ("Nutrition label") answers

**Tracking:** No. No data is used to track users across other companies'
apps or websites. No ad networks or data brokers are involved.

**Data collected and linked to the user, used for App Functionality only:**

| Apple category                                                                 | Data type               | Collected?        | Notes                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ----------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact Info                                                                   | Email Address           | Yes               | Account sign-in                                                                                                                                                                                                                                                                               |
| Contact Info                                                                   | Name                    | Yes               | Profile first/last name                                                                                                                                                                                                                                                                       |
| Contact Info                                                                   | Other User Contact Info | Yes               | Optional contact a user types into a lost & found post                                                                                                                                                                                                                                        |
| Identifiers                                                                    | User ID                 | Yes               | Supabase account id                                                                                                                                                                                                                                                                           |
| User Content                                                                   | Photos or Videos        | Yes               | Photos only (avatars, posts, listings, clubs, messages)                                                                                                                                                                                                                                       |
| User Content                                                                   | Emails or Text Messages | Yes               | In-app messages                                                                                                                                                                                                                                                                               |
| User Content                                                                   | Other User Content      | Yes               | Posts, comments, polls, activities, clubs, listings, reports                                                                                                                                                                                                                                  |
| User Content                                                                   | Customer Support        | Yes               | Support requests                                                                                                                                                                                                                                                                              |
| Location                                                                       | Coarse Location         | Yes               | Optional ~100 m pins on activities/posts/listings                                                                                                                                                                                                                                             |
| Location                                                                       | Precise Location        | **No** (see note) | Used once in real time to check the neighborhood boundary and **not stored**. Apple counts data as not collected when it is processed only in real time and not retained. **Owner:** confirm with counsel; if you prefer to disclose conservatively, answer "Yes, App Functionality, linked". |
| Sensitive Info                                                                 | —                       | No                | Date of birth is not a listed Sensitive Info type; it is stored privately to enforce the 18+ organizer rule. **Owner:** consider listing it under "Other Data" to be conservative.                                                                                                            |
| Usage Data, Diagnostics, Financial, Health, Browsing, Search history, Contacts | —                       | No                | No analytics, crash-reporting, payments or contacts access                                                                                                                                                                                                                                    |

The same declarations are in `app.json → ios.privacyManifests`. The
manifest also declares the required-reason APIs React Native uses:
UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1 and
DiskSpace E174.1.

**Third parties that receive data:** Supabase (hosting, database, auth,
storage), Apple and Google (only for their sign-in), Apple Maps (map tiles,
no account data), and the email provider configured in Supabase Auth.
