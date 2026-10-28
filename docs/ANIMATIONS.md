# Loading animations and feedback effects

All animations are plain CSS plus small ES modules (no extra dependencies). They are shown only while something is really happening and never fake progress.

## Files
| File | Purpose |
|---|---|
| `public/index.html` | start-up screen markup (appears before any script runs) |
| `public/js/splash.js` | drives the start-up screen with real stages |
| `public/js/loaders.js` | `loader()`, `showLoader()`, `overlay()` – vocabulary, lesson, quiz, progress, import and generic loaders |
| `public/js/motion.js` | animation preference, stars/confetti (`burst`), `countUp`, `play` |
| `public/css/motion.css` | all keyframes, page transitions, button feedback, reduced-motion rules |
| `public/js/app.js`, `views/start.js`, `review.js`, `vocabulary.js`, `lesson.js`, `profile.js`, `admin/assets/…` | where they are used |

## Start-up screen
Four real stages: interface texts loaded → site settings + account loaded → account language applied → first page drawn. The bar shows finished stages / 4 and only moves when a stage finishes (a test holds the server back and checks that the bar stays put). If JavaScript never starts, a CSS-only notice with a reload link appears after 25 s; if start-up fails the screen is replaced by the error message with a Retry button.

## Loaders (used only while loading)
* vocabulary list → floating words + letters typed one by one; learning path / achievements → the path draws itself; lesson start → animated book and stars (full-screen overlay); quiz / review start → letters and answer cards; admin vocabulary import → word cards with a counter of the real number of rows; everything else → three bouncing dots.
* A loader appears only after 140 ms, so quick requests never flash one. Progress bars are indeterminate unless a real fraction is passed. After 15 s a loader says it is taking longer than usual and offers Retry; requests time out after 30 s with a clear message.

## Feedback
Correct answer: green glow, stars, floating `+XP`. Wrong answer: shake and the right answer pulses. Lesson complete: confetti, XP and accuracy count up to the real server values, new badges are revealed, a streak flame appears only if the streak really grew. The XP chip counts up and the streak chip pops when the real values change. Buttons have hover / press feedback. Pages fade, slide or scale in (lessons zoom in).

## Turning animations down or off
* The operating system's "reduce motion" setting is respected automatically.
* Profile → Appearance → Animations: Automatic (follow the device), Always on, Off. The choice is stored on the device (`localStorage['lexi.motion']`) and sets `<html data-motion="on|off">`.
* With animations off nothing is hidden: every element is visible in its normal state; only the movement is removed.

## Tests
`node tests/ui/motion.ui.js` (also part of `npm run test:ui`) covers the start-up screen (real stages, failure + retry), each loader appearing and disappearing, page transitions, answer feedback, lesson-completion effects with server-checked numbers, reduced motion and the setting, the slow-loader retry and the admin import counter, on desktop and mobile widths. The other browser suites run with animations off so measurements are deterministic.
