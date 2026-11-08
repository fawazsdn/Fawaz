# App Store screenshot kit

**Status:** App Store Connect has one older simulator image. The physical-iPhone set for the release candidate is pending. Use actual app screens from the approved build.

## Capture sizes

- Capture original portrait PNGs at **1290 × 2796** on an iPhone 15 Pro Max or **1320 × 2868** on an iPhone 16 or 17 Pro Max. Apple accepts both sizes in the large Dynamic Island display set.
- No iPad set is needed because the app is iPhone-only.
- Prepare Arabic and English (U.S.) captures for the corresponding listing locales. Apple allows up to ten per set.

[Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

## The six screenshots

| #   | File id        | Screen to capture                        | Arabic caption            | English caption                |
| --- | -------------- | ---------------------------------------- | ------------------------- | ------------------------------ |
| 1   | `1-home`       | Home tab                                 | حيك كله في مكان واحد      | Your Neighborhood in One Place |
| 2   | `2-activities` | Activities tab with several activities   | اكتشف فعاليات وأنشطة حيك  | Discover Local Activities      |
| 3   | `3-clubs`      | Explore → Clubs, or an approved club     | انضم لأندية حيك           | Join Neighborhood Clubs        |
| 4   | `4-neighbors`  | Explore → Neighbors                      | تعرّف على جيرانك          | Connect With Your Neighbors    |
| 5   | `5-map`        | Map tab with activity pins               | اكتشف الأماكن القريبة منك | Explore Your Neighborhood      |
| 6   | `6-community`  | Neighborhood feed with a post and a poll | مع بعض، حارتنا أحلى       | Better Together                |

The captions are also in `captions.json`, which `compose.mjs` reads.

## How to capture (on a Mac)

1. Use the **review neighborhood** from `../review-notes.md`, never a real
   neighborhood. Screenshots must not show real residents' names, photos or
   messages without their consent.
2. Choose existing privacy-safe screens and approved public business information. Any new demonstration content must be team-created, clearly labeled, and approved for the review neighborhood.
3. Install the release candidate from internal TestFlight on the iPhone.
4. Switch Haratna to Arabic and capture the six screens with the side and volume-up buttons. Keep the original dimensions and avoid notification banners.
5. Switch to **English** and capture the same six screens.
6. Save them as `raw/<file id>-ar.png` and `raw/<file id>-en.png`, for example
   `raw/4-neighbors-ar.png`.
7. Keep the original captures. If using optional frames and captions, compose and verify them against the original images:
   ```sh
   npm ci --prefix web
   npm exec --prefix web -- playwright install chromium
   node docs/app-store/screenshots/compose.mjs
   ```
   Output goes to `out/6.9/` and `out/6.5/`. Missing captures are skipped and
   listed; they are never generated.
8. Check every image before uploading: nothing private, no placeholder text,
   no debug UI. Upload in App Store Connect → the 1.0 version → Arabic, then
   English.

## Design

`template.html` uses the brand palette: a gradient from #0D4939 to #07352A,
a #F4EFE3 caption, a #D2B078 accent rule and a #83977A frame. The caption
sits on top and the real capture fills the device frame underneath. The
Arabic captions render right-to-left.

The composition was checked with a test image (output size verified at
1320×2868 and 1284×2778). That test image was not kept.
