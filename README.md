# ANJAL.EXE · THE RECRUIT'S JOURNEY

A playable portfolio — not a scroll page. You are the recruiter. Your mission: survey **Anjal Karki** across 6 levels, earn XP, unlock achievements, and claim the recruit.

**🎮 Live demo:** https://anjalkarki123.github.io/AnjalKarkiGamingPortfolio/

---

## What it is

A fully interactive game-portfolio built from scratch with vanilla HTML, CSS, JavaScript, and Three.js. No frameworks, no build step, no bundler — just pure web, designed to run anywhere.

- **BIOS boot sequence** on load (skip with any key)
- **6 levels** of gameplay: Identity → Skill Tree → Armory → Quest Log → Guild Hall → Recruit
- **Three.js 3D background** — particle field, wireframe octahedron "AI core", orbital rings, moving grid floor
- **Web Audio synthwave soundtrack** with 3 tracks (Synthwave / Arcade Funk / Beast Mode) — 100% synthesized, no files
- **10 unlockable achievements** including a hidden **Konami code** easter egg
- **Click particle bursts**, **mouse trail**, **screen shake**, **CRT scanlines**, **custom cursor**

---

## How to play

| Key | Action |
|---|---|
| `SPACE` / `→` / `Enter` | Next level / advance |
| `←` | Previous level |
| `1` – `6` | Jump to any level |
| `M` | Open world map (warp) |
| `N` | Toggle music |
| `ESC` | Close map / modal |

### Collectibles
- **LVL 03 · Armory** — click any project to open details; some have **LAUNCH PROJECT** buttons to live demos / downloads
- **LVL 04 · Quest Log** — click any experience card to claim **+250 COIN** (4 claimable, once each)
- **Hidden Konami code** — `↑ ↑ ↓ ↓ ← → ← → B A` → **GOD MODE** (+50,000 XP, confetti, secret lore)

---

## Projects showcased

| Project | Type | Link |
|---|---|---|
| RCDS Invoicing Platform | Full-stack · AI | Internship (private) |
| AI Crop Intelligence | Lovable AI chatbot | [helpfarmer.lovable.app](https://helpfarmer.lovable.app) |
| UIdaho International Hub | Community web app | [uidahointernationalhub.lovable.app](https://uidahointernationalhub.lovable.app) |
| Lost Map Studio | Unity / C# 2D game | Android & PC downloads (in-app) |
| Reminder App | Python · Tkinter | Local desktop |
| Budget Guardian | Vandal Hackathon web app | [anjalkarki123.github.io/Vandal-Finance-Hackathon](https://anjalkarki123.github.io/Vandal-Finance-Hackathon/) |

---

## Experience levels

- **Application Development Intern** — RCDS · IIDS · University of Idaho (MAR 2026 — PRESENT)
- **ESPN+ Broadcast · Athletic Video** — Idaho Athletics (JUL 2025 — PRESENT)
- **Mathematics Tutor** — University of Idaho (JAN 2025 — PRESENT)
- **Canvas Accessibility Assistant** — University of Idaho (JAN 2026 — MAR 2026)

---

## Running locally

No build step required. Just serve the folder over HTTP (required because it uses ES modules):

```bash
# Option 1 · Python
python -m http.server 5500

# Option 2 · Node
npx http-server -p 5500

# Option 3 · VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Then open `http://localhost:5500`.

---

## Tech stack

- **Three.js 0.160** · 3D background (CDN import map — no bundler)
- **Web Audio API** · custom synthesizer for music tracks & UI sound effects
- **Canvas 2D** · particle bursts, mouse trail, confetti
- **Vanilla JS modules** · game state machine, level navigation, achievements, Konami detector
- **CSS** · arcade / cyberpunk theme with CRT scanlines, rainbow gradients, glow shadows
- **Press Start 2P** · arcade display font
- **JetBrains Mono** · HUD & terminal text
- **Space Grotesk** · body copy

---

## Credits

**Designed, built, and shipped by [Anjal Karki](https://linkedin.com/in/anjal-karki-258298226)** — Computer Science · University of Idaho · Class of 2027.

**Claude (Anthropic)** assisted with architecture, Three.js scene design, the synthwave engine, and this README.

---

## Contact

- **Email** — [karkiaj1738@gmail.com](mailto:karkiaj1738@gmail.com)
- **LinkedIn** — [/in/anjal-karki-258298226](https://linkedin.com/in/anjal-karki-258298226)
- **Phone** — +1 (208) 997-7552
- **Status** — Open to 2026 internships

---

*Press START to begin.*
