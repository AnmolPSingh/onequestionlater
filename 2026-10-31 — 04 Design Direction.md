# Design Direction: curiousenough.com

*How it should look, move and feel. Decisions marked **[Decide]** need Anmol's call before the build starts.*

---

## The feeling

It should feel like late night in a studio. One lamp on, a record still spinning, someone telling you a story they've told before but still enjoy telling. Warm, a little cinematic, and never in a hurry.

It should not feel like a SaaS landing page, a Dribbble shot or a template portfolio. No gradient blobs, no card grids, no logo walls, no "years of experience" counters.

## Palette

**[Decide]** The ISDI deck used Philanthropel's emerald. The site should have its own palette so the two brands don't blur. Proposed: "on air".

| Token | Value | Use |
| :--- | :--- | :--- |
| `--night` | `#0d0c0b` | Main background. Warm black, not blue black. |
| `--ink` | `#16130f` | Raised surfaces on dark. |
| `--paper` | `#f3eee4` | Paper chapters (06 School, Ask Anmol) and text on dark. |
| `--onair` | `#ff8a2a` | The single accent. Recording light, cursor, focus ring, "Curiosity". |
| `--dim` | `rgba(243,238,228,.56)` | Secondary text on dark. |
| `--hair` | `rgba(243,238,228,.12)` | Rules and outlines. |
| `--pencil` | `#3a342c` | Text on paper. |

The accent is used sparingly, about once per screen. When it appears, it means "this is the point".

Contrast: check every text pairing at WCAG AA. `--dim` on `--night` must pass for body text at the chosen size, or be used only for labels at 18px and above.

## Type

**[Decide]** The deck used Urbanist and IBM Plex Mono. Philanthropel also uses Urbanist, so keeping it ties the two together, which may or may not be what you want.

- **Option A (keep the deck's DNA):** Urbanist for display and body, IBM Plex Mono for labels and captions.
- **Option B (own voice):** a characterful serif for the big "Be curious enough to..." lines (Fraunces or Instrument Serif), Inter or Urbanist for body, IBM Plex Mono for labels.

Recommendation: Option B. The serif makes the sentence feel written, not designed, and separates the site from Philanthropel.

Scale (fluid, using `clamp`):
- Chapter H: 44px on mobile up to 112px on desktop. Tight leading (1.0), slight negative tracking.
- Pull line: 28px to 56px.
- Body: 18px to 21px, line height 1.6, measure about 60 characters.
- Mono labels: 12px to 14px, uppercase, wide tracking.

Self-host every font as woff2. No Google Fonts request at runtime.

## Layout

- One long page. Each chapter is at least one viewport tall, most are two or three, so the scroll has room to breathe.
- Text sits in a left column on desktop. The motion graphic takes the right side. The photo drops in as a tilted print (2 to 4 degrees, soft shadow, thin white border), overlapping the graphic slightly. This is the deck's rule: the graphic leads, the photo supports.
- On mobile, everything stacks: H, graphic, body, photo, pull line.
- Generous empty space. The "So naturally, I said yes." beat and the "I did not." beat each need a full screen of nothing before them.
- A thin chapter rail on the right edge (desktop) shows progress: eight ticks, the current one lit in `--onair`.

## Motion

Library: GSAP with ScrollTrigger. Optionally Lenis for smooth scrolling, but only if it doesn't fight native scroll on mobile.

Principles:
1. **Scroll drives the story, not the clock.** Most animation is scrubbed to scroll position. Nothing important plays on a timer the reader can miss.
2. **One idea moves at a time.** If the graphic is animating, the text holds still, and the other way round.
3. **Ease like a fader, not a bounce.** `power2.out` and `power3.inOut`. No elastic, no back, no overshoot.
4. **Text reveals by line, not by letter.** Except the opening sentence, which types.
5. **Pin sparingly.** Pin a chapter only when the graphic needs scroll time to transform (07's diagram simplifying, the pattern section).

Per chapter motifs (carried over from the deck):

| Chapter | Motif | Behaviour |
| :--- | :--- | :--- |
| 00 Opening | Cursor | Types the sentence, then cycles endings. Stops cycling once you scroll. |
| 01 Music | Waveform | A live-looking waveform that grows in amplitude as you scroll in. |
| 02 The tool | Posters | Poster frames fan out like a hand of cards. "Tool unlocked" chip slides in. |
| 03 The question | Radio waves, then film strip | Concentric waves from a dot; they straighten into a film strip that scrolls sideways. |
| 04 Yes | App screens | Empty phone outlines fill in with UI, one by one. |
| 05 The room | Orbit | Five department labels orbit a single dot labelled "design". |
| 06 School | Collage | Photos pin onto a paper board, slightly crooked, like a studio wall. |
| 07 Remove | Process diagram | A tangled diagram loses boxes and lines as you scroll until it's three clean steps. |
| 08 Next | Logo render | The Philanthropel logo video plays once when in view, then holds the last frame. |
| Pattern | Words | Seven words line up, dim one by one, "Curiosity" lights in `--onair`. |

### Calm mode and reduced motion

- If `prefers-reduced-motion: reduce` is set, start in Calm mode.
- Calm mode: no scrubbing, no pinning, no typing. Text and images fade in at most (200ms opacity). Graphics show their final state.
- The toggle is always available in the header and remembers the choice in `localStorage` (wrapped in try/catch).

## Sound

**[Decide]** Off by default. If on, a quiet loop of Anmol's own track plays under the music chapter only, fading out by chapter 03. Never autoplay. Never another artist's music.

## Photos

- Treatment: slight warm grade so photos from different years sit together. No heavy filters.
- Every photo gets real alt text describing what's in it, not "image".
- Serve as AVIF with WebP fallback, sized for 1x and 2x, lazy loaded except the first one.

## Things to avoid

- Em dashes anywhere in the copy.
- Stock photos, icons from a generic pack, or AI-generated images of Anmol.
- Anything that looks like a dashboard of GP work.
- A cursor follower, a preloader with a percentage, or scroll hijacking that changes the scroll speed.
