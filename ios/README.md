# Storm IQ · iOS + CarPlay starter

You have an Apple Developer account — this folder is the starting path for a real CarPlay surface.

## Reality check

| Capability | Requirement |
|------------|-------------|
| iOS app (TestFlight / device) | Your paid Developer Program membership |
| **CarPlay** | Additional **CarPlay entitlement** from Apple (not automatic with a standard account) |
| Map-style CarPlay UI | Usually `com.apple.developer.carplay-maps` or a supported template entitlement |

Apple must approve CarPlay for your App ID. Until then you can still ship the phone app and test everything except the in-car screen.

## Recommended phases

### Phase 1 — iPhone app (do this first)
WKWebView shell loading `https://storm-iq.vercel.app` with:
- Full-screen web UI
- Location permission passthrough
- Keep-awake while chasing
- Push notifications later (APNs)

### Phase 2 — Request CarPlay entitlement
In [developer.apple.com](https://developer.apple.com):
1. Identifiers → App ID → enable CarPlay (when available) / request entitlement
2. Submit CarPlay entitlement request with use-case: *safety-oriented weather awareness for drivers / storm observers; list of active NWS warnings near route; open navigation in system maps*
3. Wait for Apple approval before CarPlay APIs will work on device

### Phase 3 — CarPlay templates (after entitlement)
Good fit for Storm IQ (no custom map drawing required):

1. **CPListTemplate** — Top targets / TOR / SVR / FFW counts  
2. **CPInformationTemplate** — Expanded warning text  
3. Action → open Apple Maps directions to a safe observation point (not into the core)

Avoid promising turn-by-turn storm-core avoidance on CarPlay until you have a certified navigation stack.

## Xcode setup (Phase 1)

1. Open Xcode → New Project → App (SwiftUI)
2. Bundle ID e.g. `app.stormiq.mobile`
3. Replace ContentView with a `WKWebView` pointed at production  
4. Info.plist:
   - `NSLocationWhenInUseUsageDescription`
   - `UIBackgroundModes` only if you add real background fetch later
5. Run on your iPhone

Swift starter files in this folder are **reference stubs** — paste into an Xcode project (Git alone doesn’t build iOS apps on Vercel).

## Files here

- `StormIQWebView.swift` — Phase 1 web shell
- `CarPlaySceneDelegate.swift` — Phase 3 list template sketch
- `Info-CarPlay.plist.example` — keys you’ll need after entitlement

## Safety copy (put in the app)

> Storm IQ is situational awareness software. It does not replace NWS warnings, vehicle navigation, or emergency instructions. Never drive into a tornado or flash-flood warning to “get a closer look.”
