# Device Dashboard Expansion Design

## Context

The current `DeviceInfoResponseDto` already provides enough information to build a compact dashboard for:

- `/pet-profile/1`
- `/main-view-map`

The goal is not to expose every available telemetry field. The goal is to surface the few signals that answer the question: **is this device currently in a healthy state?**

The page styling must remain aligned with the existing app language:

- dark green surfaces
- rounded cards and pills
- bright green primary accent
- compact mobile-first layout
- existing typography and navigation patterns

## Product Goal

Show the most important device state first, without overloading the screen.

Primary signals:

- battery
- alarm
- GPS fix / no fix

Secondary signals:

- assigned pet
- recent location
- freshness of data
- optional device diagnostics in a collapsed area

## Proposed Information Hierarchy

### First Layer

These elements must be visible immediately:

- last known battery state
- alarm state
- GPS fix state, represented by `locationStatus`

### Second Layer

These elements support quick context without clutter:

- `assignedPet`
- last known position
- `traccarLastUpdate` or a comparable freshness indicator
- `connectivityStatus` only if it helps explain why GPS data may be missing or stale

### Third Layer

These fields are useful but not essential for the dashboard:

- `charging`
- `liveTrackingEnabled`
- diagnostic telemetry such as `rssi`, `sat`, `motion`

These should live in a collapsed section, accordion, or modal.

## Alarm Rules

Alarm presentation is binary and simple:

- if `alarmTime != null`, the alarm is active and must be shown
- `alarmType` is shown together with `alarmTime`
- if `alarmTime == null`, no active alarm is displayed

Alarm should be visually prominent enough to read as a warning or critical state.

## Battery Rules

Battery is always shown on the main dashboard.

Preferred presentation:

- numeric percentage
- icon or color state based on severity
- optional charging indicator if helpful, but not required to understand battery level

Battery should be treated as a primary status element, not a hidden detail.

## GPS / Location Rules

`locationStatus` is treated as the user-facing answer to:

- do we have a fix?
- do we have usable location data?

Suggested interpretation:

- `LIVE` means GPS fix and fresh location
- `STALE` means location exists but the source is not live
- `NO_POSITION` means no known location

This status belongs on the first layer.

## Page Behavior

### `/pet-profile/1`

This view should feel like a device summary page with pet context.

Show immediately:

- pet identity
- device identity
- battery
- alarm
- GPS fix

Then provide:

- latest position summary
- data freshness
- one compact details area for secondary telemetry

### `/main-view-map`

This view should remain map-first.

The map remains the main focus, while the bottom sheet or side panel shows:

- battery
- alarm
- GPS fix
- last known position

Avoid duplicating the full telemetry set on the map screen.

## Collapsed Details

Everything beyond the first layer should be grouped into a deliberate secondary interaction:

- accordion section
- collapsible card
- modal

The expanded area can include:

- `charging`
- `liveTrackingEnabled`
- `connectivityStatus`
- `assignedPet`
- technical telemetry values

This keeps the dashboard readable while still allowing power users to inspect more detail.

## Visual Direction

Reuse the current app style rather than introducing a new visual theme.

Design cues:

- dark surface containers
- green accent for healthy state
- amber or red for warning/critical state
- compact pill badges for state labels
- existing spacing rhythm and rounded card treatment

The result should feel like part of the current app, not a separate product surface.

## Scope Guardrails

To avoid overloading the screen, do not add new top-level widgets unless they materially improve the immediate state read.

Acceptable additions:

- `assignedPet` if it helps identify the context quickly
- freshness of data if it helps explain stale or missing location

Avoid adding:

- long diagnostic lists on the first screen
- repeated telemetry in both views
- non-essential analytics that do not help an operator make a quick judgment

## Open Tuning Points

These are intentionally left for later correction:

- exact order of the second-layer fields
- whether `connectivityStatus` belongs in the visible summary or only in details
- whether `traccarLastUpdate` is shown as a timestamp or relative time
- exact color thresholds for battery severity

## Success Criteria

The design is successful if:

- battery and alarm are always easy to find
- GPS fix status is visible without scrolling or expanding
- the screen still feels lightweight
- users can access deeper telemetry without cluttering the main view

