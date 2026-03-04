# Ready to Talk

## Product intent
- Ready to Talk helps people connect when they are ready to talk.
- The product should reduce social friction, not increase it.
- Early experiences should feel calm, low-pressure, and consent-first.

## Current working assumptions
- The primary experience is phone-first.
- QR codes will be a core connection mechanic for in-person handoff.
- The product is still in discovery, so optimize for clear prototypes over premature abstraction.
- When requirements are missing, choose the simplest flow that can be tested quickly with real users.

## UX principles
- Prioritize mobile layouts and thumb-friendly interactions first.
- Make the next action obvious within a few seconds.
- Treat readiness, privacy, and consent as first-class UX concerns.
- Avoid manipulative patterns, urgency tricks, or noisy interfaces.
- Prefer human language over product jargon.

## Product direction for near-term work
- Replace starter framework branding and demo content as soon as related files are touched.
- Build toward a clear landing experience that explains the idea in one screen.
- Keep QR-based connection flows lightweight: scan, understand, confirm, connect.
- Preserve room for future account, profile, and conversation-state features without overbuilding them now.

## Technical guardrails
- Keep the stack aligned with the current app unless there is a strong reason to change it:
  - TanStack Start
  - React + TypeScript
  - Tailwind CSS v4
  - Cloudflare deployment path
- Prefer small, composable route and component changes over large rewrites.
- Do not add heavy dependencies for simple UI or utility needs.
- Keep server/client boundaries explicit when adding data loading or mutations.

## Agent expectations
- Start by understanding the current code before changing structure.
- When making product decisions without explicit instruction, bias toward:
  - mobile-first behavior
  - simple QR-centered flows
  - privacy and consent
  - fast prototype velocity
- If a proposal conflicts with the core idea of "talk when ready," call that out and choose a calmer alternative.
- Leave concise comments only where logic is non-obvious.

## Copy and tone
- The brand should feel warm, direct, and respectful.
- Avoid sounding clinical, corporate, or overly playful.
- Prefer short sentences and plain language.

## Definition of a good first version
- A person can understand what Ready to Talk does immediately.
- A phone user can move through the main flow without friction.
- QR connection behavior is understandable before backend complexity exists.
- The app feels trustworthy enough that someone would try it with another person nearby.
