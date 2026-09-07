---
name: etsy-streamer-digital-products
description: Design and package ANY sellable digital product for streamers — overlay widgets (loyalty card trackers, alert boxes, goal bars, chat boxes), static branding kits (webcam frames, panels, banners/channel art, profile pictures), emote and sub-badge packs, YouTube thumbnail templates and end screens, and scene-transition packs ("starting soon"/"BRB"/"ending") — ready to list on Etsy. Covers Twitch, YouTube, and Kick, and both animated/interactive (OBS Browser Source) and static (PNG/SVG/Canva/Photoshop) formats. Use this skill whenever the user wants to create ANY kind of stream graphics, channel branding, or digital download aimed at streamers/content creators as an Etsy product — not just overlays. Trigger even if the user only says "widget," "overlay," "emotes," "badges," "thumbnail template," "panels," or "channel art" without saying "Etsy," "Twitch," or "YouTube" explicitly, as long as context suggests a stream-graphics or creator-branding digital product. If the request is narrowly and only about interactive OBS overlay widgets specifically, the more specific etsy-twitch-overlay-widgets skill is an equally valid choice — either skill can be used, but this one should be preferred when the request spans multiple product types or is about creator branding more broadly.
---

# Etsy Streamer Digital Products

A skill for turning any streamer/creator-branding idea into a finished, sellable Etsy digital-download package — the product files themselves, Etsy mockup images, and Etsy-ready listing copy — across the full range of what streamer-graphics shops sell, not just overlays.

## What this skill produces

A complete sellable listing has three deliverable groups. Always aim to produce all three unless the user asks for only one:

1. **The product itself** — the actual files the buyer downloads and installs/edits.
2. **Mockup/preview images** — how the product looks in context, for the Etsy listing gallery.
3. **Listing copy** — title, tags, category, description, and suggested price.

## Step 1 — Identify the product category

Streamer-graphics shops on Etsy sell across several distinct product families. Don't assume "overlay" by default — ask or infer which family (or families) the user means:

| Category | Examples | Typical format |
|---|---|---|
| **Interactive overlays** | Loyalty card/points tracker, follow/sub/donation/raid alert box, subscriber/follower goal bar, animated chat box | HTML/CSS/JS (OBS Browser Source) |
| **Static overlay graphics** | Full-screen overlay frame, webcam frame/border, "just chatting" screen | Layered PNG/SVG |
| **Scene/transition packs** | "Starting soon," "BRB," "Ending stream," stinger transitions | Static image set, or short looping video/animated GIF |
| **Channel branding kits** | Twitch panels (About/Rules/Schedule/Socials), YouTube channel art (banner), profile picture, Discord server icon | Static PNG/SVG at platform-specific dimensions |
| **Emotes & badges** | Sub badges, bit/cheer emotes, YouTube member emotes, static or animated | Small PNG (28×28 up to 112×112 per Twitch/YouTube specs) |
| **Thumbnails & end screens** | YouTube thumbnail template (editable in Canva/Photoshop), video end-screen layout | PSD/Canva template, or flat PNG |

If the user's request already names the category (e.g., "loyalty card widget," "YouTube banner," "sub badge pack"), don't re-ask — just proceed. If it's ambiguous ("I want to sell streamer graphics"), ask which category(ies) before building.

## Step 2 — Nail down the concept

Once the category is set, confirm (ask only if genuinely ambiguous, otherwise assume sensibly and state the assumption in one line):

- **Platform**: Twitch, YouTube, Kick, or a bundle that works across all three. This affects dimensions and terminology (e.g., Twitch "panels" vs. YouTube "channel art"; Twitch "sub badges" vs. YouTube "member badges").
- **Aesthetic/niche**: e.g. pastel kawaii, cottagecore, neon cyberpunk gaming, minimalist line-art, retro pixel, dark academia. This niche sells almost entirely on aesthetic — pick one clear theme rather than generic, and keep it consistent if building a multi-item bundle.
- **Single item vs. bundle**: a full "channel branding kit" (panels + banner + overlay + badges in one matching theme) sells at a higher price point than a single item and is a common, high-performing Etsy listing type — offer this as an option when the user's ask is open-ended.
- **License terms**: standard Etsy streamer-graphics shops sell a "personal streaming use" license and prohibit resale/redistribution of source files. Default to this unless told otherwise.

## Step 3 — Build the product

Read `/mnt/skills/public/frontend-design/SKILL.md` before building any HTML/SVG asset — it has this environment's design-token and styling conventions and keeps output from looking templated.

**Interactive overlays (HTML/CSS/JS):**
- Self-contained HTML file, transparent `background: transparent;` on `html, body` so it composites correctly as an OBS Browser Source.
- All state in JS variables (no localStorage — unsupported here, and unnecessary for a single OBS session).
- Expose "live" numbers (points, sub count, goal progress) as clearly labeled variables near the top with a comment like `// EDIT ME: starting point values`, since non-coder buyers (or their own AI assistant) will edit these directly.
- Simple CSS animations (pulses, slide-ins, particle bursts) for alerts — a major differentiator in reviews.

**Static overlay/branding graphics (PNG/SVG):**
- Build layered SVGs or PNG sets at the correct platform dimensions, transparent background where the asset sits over gameplay or video:
  - Full overlay frame: 1920×1080
  - Twitch panel: 320×300 (width fixed by Twitch, height flexible)
  - YouTube channel art (banner): 2560×1440 canvas, keep essential content inside the ~1546×423 "safe area" that shows on all devices
  - Twitch/YouTube profile picture: 800×800
  - Sub/member badge: 18×18, 36×36, 72×72 (Twitch requires all three sizes per badge)
  - Bit/cheer emote or member emote: 28×28, 56×56, 112×112
- Keep consistent palette, stroke weight, and corner radius across every piece in a themed set.

**Scene/transition packs:**
- Static: same dimensions as full overlay frame (1920×1080), one image per scene state (Starting Soon / BRB / Ending / Just Chatting).
- Animated: build as a short looping HTML/CSS/SVG animation the buyer can record as a stinger, or a sequence of frames if a GIF/video is specifically requested — note that generating actual video/GIF files may require tools outside this environment, in which case hand off an animated HTML preview plus clear frame-export instructions.

**Thumbnail templates & end screens:**
- YouTube thumbnail canvas: 1280×720. Build as an editable template (labeled layers/placeholder text boxes) rather than a single flattened image, since buyers reuse these per-video.
- End screen: 1920×1080 with clear placeholder zones matching YouTube's end-screen element slots (video, subscribe button, playlist).

**Cross-cutting rule:** avoid any copyrighted characters, brand marks (platform logos, game logos/art), paid-license fonts, or real streamer/game likenesses — build every visual asset from scratch using generic "stream" iconography.

Save deliverables to the workspace, then to `/mnt/user-data/outputs/`.

## Step 4 — Generate Etsy mockup images

Buyers judge these listings almost entirely on the preview image. Build 1–3 mockups per product showing it in context — e.g., an overlay composited over a generic, non-copyrighted "gameplay" scene; a banner shown on a mock YouTube channel header; a badge shown next to a mock username in a mock chat. Never use real streamer photos, real game screenshots, or copyrighted game/character art — build the mock context from scratch (abstract shapes, generic UI chrome) same as the product itself.

If the visualizer tool is available, use it for a quick preview render; otherwise build the mockup as its own HTML/SVG file, noting it can be screenshotted for the listing.

## Step 5 — Write the Etsy listing copy

- **Title**: keyword-front-loaded, ~130–140 characters, format like `[Theme] [Product Type] for Twitch/YouTube, [Specific Item], [Style] Streamer Graphics, Digital Download`. Lead with the terms buyers actually search (product type + theme), not a shop brand name.
- **Tags**: exactly 13, each ≤20 characters, mixing broad ("twitch overlay," "youtube banner," "sub badges") and specific ("pastel loyalty widget," "kawaii sub badge pack"). No duplicate concepts across tags.
- **Category**: Craft Supplies & Tools > Digital > Templates, or Paper & Party Supplies > Templates, depending on Etsy's current taxonomy — flag that this may have shifted and suggest the user verify in their own Etsy dashboard.
- **Description structure**: 1-sentence hook → what's included (exact file list, dimensions, formats) → how to use it (brief install/edit steps — OBS Browser Source for overlays, Canva/Photoshop for templates, platform badge-upload steps for badges) → license terms (personal streaming use, no resale) → what's NOT included (Etsy requires clarity this isn't a physical product).
- **Pricing**: genuinely variable by complexity — give a *range with reasoning* (e.g., a single static banner prices lower than a full multi-item branding bundle with animated overlays) rather than a confident number, and suggest checking current comparable listings for calibration, since pricing trends shift.

Write listing copy as a markdown file the user can copy from directly.

## Step 6 — Package and present

Bundle into a clear folder structure before presenting (adjust subfolders to whichever categories were actually built):

```
product-name/
├── product/            (the actual files the buyer uses — .html, .png, .svg, .psd)
├── mockups/            (preview images for the listing gallery)
├── listing-copy.md     (title, tags, description, pricing notes)
└── install-instructions.md   (buyer-facing: how to install/edit per file type)
```

Zip this folder, save to `/mnt/user-data/outputs/`, and present it with `present_files`. Keep the chat response short — the files are the deliverable, not a restated description of them.

## Notes

- Never fabricate specific current Etsy fee amounts, policy text, taxonomy paths, or platform badge/emote size specs from memory if precision matters — these change; search the platform's current seller/creator docs rather than stating a remembered number as current fact when it's load-bearing for the user's listing.
- Keep every visual asset built from scratch — no scraped stock photos, no copyrighted game art, no real streamer likenesses.
- When a request spans multiple categories (e.g., "a full branding kit"), build all pieces in one consistent theme rather than treating them as unrelated one-offs — this is what makes bundle listings sell.
