# App Store screenshot kit

**Status: no screenshots have been captured yet.** This environment is a
Linux container with no iOS Simulator and no device, so it cannot take
genuine iOS captures. `raw/` is empty on purpose. Do not upload mock-ups:
Guideline 2.3.3 requires screenshots that show the app in use.

## What Apple needs

- **iPhone 6.9"**: 1320 × 2868 portrait (iPhone 16/17 Pro Max). This set is
  required, and App Store Connect scales it down for smaller iPhones.
- **iPhone 6.5"**: 1284 × 2778 portrait. Optional when 6.9" is supplied;
  `compose.mjs` produces it anyway.
- No iPad set is needed, because `supportsTablet` is `false`.
- Provide one set for **Arabic** and one for **English (U.S.)**, 6 images each
  (up to 10 are allowed).

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
2. Create the content with the Haratna team accounts and label it honestly
   (for example "Haratna team: Friday walk"). Use names of team members who
   have agreed to appear. Do not invent fake residents.
3. Install the TestFlight build, or run it in the iOS Simulator on an
   **iPhone 17 Pro Max** (6.9").
4. Set the device to **Arabic** (Settings → General → Language & Region) and
   capture each of the six screens. In the Simulator, use File → Save Screen
   (⌘S); on a device, press side button + volume up. Make sure the status bar
   is clean:
   `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4`
5. Switch to **English** and capture the same six screens.
6. Save them as `raw/<file id>-ar.png` and `raw/<file id>-en.png`, for example
   `raw/4-neighbors-ar.png`.
7. Compose the framed images:
   ```sh
   npm i -D playwright   # once; Chromium is required
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
