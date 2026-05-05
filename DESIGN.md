# Design System — FrameForge

## Product Context
- **What this is:** Browser-native agentic video editor for loading media, editing on a multi-track timeline, and applying AI-planned edits safely.
- **Who it's for:** Creators, marketers, and builders who need fast post-production control without leaving the browser.
- **Space/industry:** Creative tools, AI video editing, timeline-based production software.
- **Project type:** Dense web app / editor surface.

## Aesthetic Direction
- **Direction:** Obsidian Control Room.
- **Decoration level:** Intentional, not expressive.
- **Mood:** Dark, exacting, premium, and quiet. The interface should feel like a serious production surface: precise controls, layered black materials, restrained accent color, and almost no decorative clutter.
- **Reference sites:** No live research was requested. Direction is based on product context and user preference for a clean dark sleek premium theme.

## Typography
- **Display/Hero:** Instrument Sans — geometric enough for a modern editor, warmer than default system UI.
- **Body:** Instrument Sans — keeps dense controls readable.
- **UI/Labels:** Instrument Sans with tighter weights and uppercase micro-labels where useful.
- **Data/Tables:** JetBrains Mono — strong tabular numerals for timecode, frame data, and technical values.
- **Code:** JetBrains Mono.
- **Loading:** Google Fonts import in `src/styles/globals.css`.
- **Scale:** 12px micro labels, 13px dense controls, 14px body, 16px panel titles, 20px compact headings, 32px demo hero.

## Color
- **Approach:** Restrained dark with one premium cyan accent and steel neutrals.
- **Primary:** `#8BD8FF` — active controls, play state, agent affordances.
- **Secondary:** `#A6B0BD` — secondary text and inactive controls.
- **Neutrals:** `#050608`, `#080B10`, `#0C1118`, `#121925`, `#1B2532`, `#2A3748`.
- **Semantic:** success `#33D69F`, warning `#F2B84B`, error `#FF5C7A`, info `#8BD8FF`.
- **Dark mode:** Native-only. Surfaces are separated by luminance and borders rather than large color blocks.

## Spacing
- **Base unit:** 4px.
- **Density:** Compact.
- **Scale:** 2xs(2), xs(4), sm(8), md(16), lg(24), xl(32), 2xl(48), 3xl(64).

## Layout
- **Approach:** Grid-disciplined editor layout.
- **Grid:** Fixed tool rails, elastic preview, fixed-height timeline.
- **Max content width:** Full viewport for editor; 520px launch panel.
- **Border radius:** sm 4px, md 6px, lg 8px, full 9999px. Avoid large bubbly radii.

## Motion
- **Approach:** Minimal-functional.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 80ms, short 160ms, medium 240ms.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-05 | Initial premium dark design system created | Matches the user's clean, dark, sleek, premium preference and the product's dense editor workflow. |
