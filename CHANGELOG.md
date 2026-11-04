# Changelog

All notable changes to the **Little Lovebug (Browser Pet)** Chrome extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-11-05

### Added
* **Edge Peekaboo Mode**:
  * When stationed near the viewport edges, the kitten playfully ducks behind the browser border and peeks back out to surprise the user.
  * Preserves visible position and gracefully stops on user drag, menu interaction, sleep, or reduced-motion.
* **Interactive Idle Toys**:
  * **Rolling Yarn Ball**: The kitten plays with a rolling yarn ball during idle periods.
  * **Fluttering Butterfly**: A soft butterfly flutters around the kitten before flying away.
  * **Floating Heart & Sparkles**: A floating heart balloon floats up and bursts into sparkling particles.
  * Automatic toy cycling with anti-repeat logic (`tryStartToy`) and safe cancellation on user interaction, drag, tab switch, or sleep.
* **Double-Click Quick-Pet**:
  * Double-clicking or double-tapping the kitten triggers an immediate petting reaction with rising hearts (`♥ ♡ ♥`) without opening the care menu.
  * Keyboard navigation (`Enter` / `Space`) retains instantaneous 0ms menu activation.
* **Time-of-Day Aware Care Notes & Greetings**:
  * Context-aware messages tailored to her local time of day:
    * **Morning (5:00 AM – 11:59 AM)**: Warm breakfast reminders, morning hugs, coffee/tea cheer.
    * **Afternoon (12:00 PM – 4:59 PM)**: Hydration reminders, posture & jaw relaxation checks, afternoon hugs.
    * **Evening (5:00 PM – 8:59 PM)**: Dinner reminders, decompression praise, cozy evening cuddles.
    * **Night (9:00 PM – 4:59 AM)**: Reminders not to stay up too late, sweet dreams, cozy blanket wishes.
  * Weaves dynamically with anytime romantic love notes.
* **Dynamic Sleep / Wake Up Button**:
  * The menu button dynamically displays **Sleep** when the kitten is awake, and transforms into **Wake up** when asleep.
  * Added balanced `.actions button.action-hide` styling so the menu grid remains symmetrical.

### Changed
* **Non-Repeating Love Notes (PR #8)**:
  * Merged PR #8 into `fix/idle-poses-and-walk-position`.
  * The speech bubble selection now remembers the previously shown note and selects an alternative to avoid immediate consecutive duplicates.
* **Test Suite Expansion**:
  * Updated [`tests/animation.test.cjs`](tests/animation.test.cjs) to test non-repeating notes, short message lists, dynamic Sleep/Wake button states, and time-of-day pools.

---

## [1.1.0] - 2026-10-30

### Added
* Pixel-art kitten sprite sheet atlas (768×960 transparent PNG, 4 columns × 5 rows of 192px cells).
* Idle animation system: gentle breathing, blinking, ear twitches, looking around, cat stretching, and short strolls.
* Interrupted walking memory: kitten preserves its exact visible position when interrupted by dragging, menu interactions, sleep, or tab switching.
* Interaction menu: Pet (+5 happiness), Feed (+8 happiness with munching bowl), Sleep/Wake, Rename, and Hide.
* Dragging system with normalized viewport memory across varying window sizes and multiple monitors.
* Shared Chrome storage sync across open tabs for happiness, name, sleep state, and visibility.
* Toolbar popup (`popup.html`) with kitten portrait, name display, and show/hide switch.
* Reduced-motion accessibility support via `prefers-reduced-motion`.

---

## [1.0.0] - 2026-10-29

### Added
* Initial project release of Little Lovebug Manifest V3 Chrome Extension.
* Standalone offline architecture: zero external services, zero tracking, and local-only storage.
