# Storm IQ · Android + Android Auto starter

Parallel to the `ios/` folder. Goal: phone app first, then Android Auto if it passes review.

## Reality check

| Capability | Requirement |
|------------|-------------|
| Phone app (WebView) | Google Play developer account (or sideload APK) |
| **Android Auto** | Cars App Library + category that meets [distraction guidelines](https://developer.android.com/training/cars/app-quality) |
| In-car maps | Best path: hand off to **Google Maps** (already Auto-friendly) |

Pure “open a weather website on the head unit” usually fails review. A **list of nearby NWS warnings + “Navigate with Maps”** is the realistic Auto design.

## Phases

### Phase 1 — Phone app (do this first)
Kotlin app with `WebView` loading `https://storm-iq.vercel.app`:
- Location permission
- Internet + cleartext blocked (HTTPS only)
- Optional: keep screen on while chasing

### Phase 2 — Android Auto (optional)
- Add `androidx.car.app` dependency
- `Session` + `Screen` showing TOR / SVR / FFW counts and top targets
- Actions open Google Maps directions (not a custom nav stack)
- Declare automotive features in the manifest only after you’re ready for Auto review

### Phase 3 — Play Store
- Standard mobile listing first
- Automotive / Auto as a later track once templates are solid

## Android Studio setup (Phase 1)

1. New Project → Empty Activity (Kotlin)
2. `minSdk` 26+, `targetSdk` current
3. Replace MainActivity content with the WebView sample in this folder
4. Add to `AndroidManifest.xml`:
   - `INTERNET`
   - `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` if you bridge location later
5. Run on a physical device

## Files here

- `MainActivity.kt` — Phase 1 WebView shell
- `AndroidManifest.xml.example` — permissions + activity
- `AutoSession.kt` — Phase 2 sketch (list template)

## Safety copy

> Storm IQ is situational awareness software. It does not replace NWS warnings, vehicle navigation, or emergency instructions. Never drive into a tornado or flash-flood warning to get a closer look.
