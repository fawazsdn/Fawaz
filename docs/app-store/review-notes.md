# App Review notes and review access

Apple Guideline 2.1 requires a working demo account, or a demo mode
approved in advance. Haratna's neighborhood features need a verified
membership, and verification normally checks that the device is physically
inside the neighborhood boundary. Apple reviewers are not in Saudi Arabia.
The approach below gives them full access without a client-side bypass. It
also avoids exposing real residents' content.

## How review access works (secure, audited, reversible)

1. **Pick an empty review neighborhood.** Choose an official neighborhood in
   the dataset that has **no residents** on Haratna. For example, run this
   in the SQL editor to pick one:
   ```sql
   select n.id, n.name_en, n.name_ar from public.neighborhoods n
   where not exists (select 1 from public.neighborhood_memberships m where m.neighborhood_id = n.id)
   limit 5;
   ```
   Reviewers then see only content the Haratna team creates there, never a
   real neighborhood's residents.
2. **Create two accounts in the app** (normal email sign-up, confirm email):
   - `review` account: credentials go into App Review Information.
   - `neighbor` account: a second account the team uses to accept the
     reviewer's neighbor request and reply to messages.
3. **Verify both accounts manually** from the Supabase SQL editor. This
   runs as the database owner, and every grant is recorded in
   `neighborhood_verifications` with method `manual`:
   ```sql
   select public.admin_verify_member('<review user id>', '<review neighborhood id>', 'Apple App Review account');
   select public.admin_verify_member('<neighbor user id>', '<review neighborhood id>', 'Apple App Review helper');
   ```
   Regular users cannot call this function (tested in
   `supabase/tests/compliance.sql`), so it is not a verification bypass.
4. **Add genuine starter content as the team** in the review neighborhood:
   one post, one activity, one approved club and one marketplace item. Label
   it honestly, for example "Haratna team: sample activity for review". Do
   not invent residents.
5. **Turn on discovery for the helper account** (Settings → Neighbors &
   privacy) so it appears in Discover Neighbors.
6. **After approval**, revoke access:
   ```sql
   select public.admin_revoke_membership('<review user id>', 'App Review finished');
   ```

## Text to paste in App Store Connect → App Review Information → Notes

```
Haratna is a neighborhood app for residents of Saudi Arabia. Neighborhood content is private to verified residents of each neighborhood; verification normally checks the device location against the official neighborhood boundary.

For review we pre-verified a review account in a dedicated review neighborhood, so you do not need to be in Saudi Arabia:
  Email: <review email>   Password: <review password>

What to try:
1. Sign in → Home shows the review neighborhood's posts, activities and clubs.
2. Explore → Neighbors → Discover: "<helper name>" appears because they opted in. Tap Add Neighbor; our team accepts it, after which you can message them. (Messaging is only possible between connected neighbors or about an activity/listing.)
3. Activities → open an activity → Join / Invite Neighbors.
4. Explore → Clubs → open the sample club → Join. Create → Create Club submits an application that our team reviews before it is visible (organizers must declare they are 18+).
5. Safety: every post, comment, message, profile, activity, listing and club has Report; profiles have Block. Settings → Contact support reaches our team. Objectionable words are filtered on the server.
6. Account deletion: Settings → Delete account (deletes the account and its data immediately).

Location is requested only when you tap Verify and is used once, in the foreground; coordinates are not stored. Sign in with Apple is offered alongside Google sign-in and email.

No in-app purchases, subscriptions, ads or tracking.
```

## Sign in with Apple / Google

- Sign in with Apple is offered on iOS next to Google sign-in. This meets
  Guideline 4.8, because Apple limits data to name and email, allows email
  hiding and does no ad tracking.
- **Owner check before review:** confirm the Apple and Google providers are
  enabled in Supabase Authentication. Confirm both buttons work in the
  TestFlight build. Not verified from this environment.
