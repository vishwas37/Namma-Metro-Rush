# 🚇 NAMMA RUNNER: Bengaluru Metro Rush
**Google AI Studio Mega Prompt, System Instructions & Iterative Roadmap**

---

## 🛠️ How to Use This Blueprint in Google AI Studio

1. **Model Selection:** Open [Google AI Studio](https://aistudio.google.com/) and select the latest **Gemini Pro** model (with thinking/reasoning enabled if available) for complex 3D game architecture.
2. **Format Strategy:** For instant playable previews inside AI Studio or your browser, this prompt targets a **Single-File Web App (HTML5 + Three.js + Tailwind CSS + Web Audio API)**. You can also adapt it for React Three Fiber if using AI Studio's App Builder.
3. **Workflow:**
   * Paste **Part 1 (The Mega Prompt)** to generate the playable vertical slice.
   * Use **Part 2 (The 6-Phase Roadmap)** to iteratively upgrade visuals, add underground transitions, polish the Fortnite/Subway Surfers UI, and inject local Bengaluru humor without hitting output token limits.

---

## 🚀 PART 1: The Mega Prompt (Copy & Paste into Google AI Studio)

```text
Act as a Principal 3D Web Game Developer, Technical Artist, and UI/UX Designer. 
Build a high-octane, vibrant 3D endless runner web game inspired by "Subway Surfers" and "Fortnite", themed entirely around Bengaluru's Namma Metro ("NAMMA RUNNER: Bengaluru Metro Rush").

### 1. TECHNICAL ARCHITECTURE
- Deliver a complete, self-contained single-file HTML5 application using Three.js (via CDN ES Modules) and Tailwind CSS (via CDN) so it runs immediately in a browser with zero build steps.
- Target a locked 60 FPS using object pooling for tracks, trains, coins, obstacles, and scenery chunks.
- Implement responsive controls: Keyboard (Arrow keys / WASD + Spacebar for Hoverboard) AND Touch/Mouse swipe gestures (Left, Right, Up to Jump, Down to Roll/Fast-Fall, Double-Tap for Hoverboard).
- Include input buffering and coyote time so lane-switching, jumping, and fast-falling feel snappy and responsive like Subway Surfers.

### 2. ART DIRECTION & VISUAL STYLE (FORTNITE x SUBWAY SURFERS)
- **Aesthetic:** Stylized, chunky, vibrant 3D cartoon visuals. High saturation, clean bold shapes, and exaggerated proportions.
- **Lighting & Atmosphere:** Warm sunlit Bengaluru sky (with drifting stylized clouds) for elevated sections, transitioning seamlessly into moody, neon-lit, high-contrast underground metro tunnels with overhead fluorescent light strips and glowing emergency exit signs.
- **Shaders & Juice:** Add a subtle curved-world horizon effect (classic Subway Surfers bend) or strong foreshortening, dynamic FOV kick when boosting, speed lines on screen edges during dashes, squash-and-stretch animations on the player, and burst particle effects on coin pickups and crashes.
- **Camera:** Dynamic third-person chase camera that tilts slightly into turns, lowers during rolls, zooms out during jetpack flight, and shakes on impacts.

### 3. CORE GAMEPLAY & TRACKS
- **3-Lane System:** Left, Center, Right metro tracks with third-rail detailing, sleepers, and guardrails.
- **Seamless Elevated ↔ Underground Transitions:**
  - Every ~45 seconds (or after passing 2 stations), the track smoothly ramps down into an Underground Tunnel Portal (like approaching Majestic or Cubbon Park) or ramps back up onto an Elevated Viaduct (like Indiranagar or MG Road).
  - Dynamically transition lighting, fog, skybox, and ambient reverb when entering/exiting tunnels.
- **Real Bilingual Namma Metro Stations:**
  - Periodically pass through stylized Namma Metro stations featuring platforms, yellow tactile lines, and prominent overhead bilingual signboards displaying BOTH **English** and **Kannada** script (using Noto Sans Kannada font from Google Fonts).
  - Include real stations:
    - Elevated: Indiranagar (ಇಂದಿರಾನಗರ), MG Road (ಎಂ.ಜಿ. ರಸ್ತೆ), Jayanagar (ಜಯನಗರ), Whitefield (ವೈಟ್‌ಫೀಲ್ಡ್), Baiyappanahalli (ಬೈಯಪ್ಪನಹಳ್ಳಿ).
    - Underground: Majestic (ಮೆಜೆಸ್ಟಿಕ್), Cubbon Park (ಕಬ್ಬನ್ ಪಾರ್ಕ್), Vidhana Soudha (ವಿಧಾನ ಸೌಧ), KR Market (ಕೆ.ಆರ್. ಮಾರುಕಟ್ಟೆ).
  - Trigger a sleek HUD banner when entering a station: *"Next Station: Indiranagar | ಮುಂದಿನ ನಿಲ್ದಾಣ: ಇಂದಿರಾನಗರ"*.

### 4. LOCAL BENGALURU ELEMENTS & QUIRKY DETAILS
- **Trains:** Stylized 3D Namma Metro trains (white/silver metallic body with vibrant Purple Line and Green Line accent stripes, glowing headlights, and destination boards). Include stationary trains (jumpable with ramps) and oncoming moving trains.
- **Obstacles:**
  - Metro barrier gates ("Namma Metro - Mind the Gap").
  - Yellow/black "BBMP Work in Progress" barricades.
  - Low overhead signal gantries (must roll under).
- **Collectibles:** Spinning glowing **Namma Metro Tokens / NCMC Smart Cards** (acting as coins).
- **Quirky Bengaluru Power-Ups:**
  1. **Filter Kaapi Boost (☕):** Steaming brass davara-tumbler pickup. Triggers a high-speed invincible dash with golden coffee-bean particles and speed lines.
  2. **Turbo Auto-Rickshaw Board (🛺):** Double-tap Spacebar/Screen to ride a stylized green-and-yellow hovering Auto-Rickshaw surfboard! Absorbs 1 crash with a comical horn blast ("Pee-Pee!").
  3. **Peak Bengaluru Startup Drone (🚁):** Jetpack-style flight high above the viaducts, flying past pink Tabebuia (Bengaluru cherry blossom) treetops and collecting aerial token arcs.
  4. **Masala Dosa Magnet (🥞):** Pulls all nearby Metro Tokens from all 3 lanes directly to the player.
- **Elevated Background Scenery:** Procedural Bengaluru skyline featuring vibrant pink Tabebuia trees, glass IT tech parks, stylized Vidhana Soudha domes in the distance, and funny roadside billboards (e.g., "STUCK AT SILK BOARD?", "PEAK BENGALURU", "WON'T COME - AUTO ANNA", "FREE WI-FI AT DARSHINI").
- **The Chaser:** A stylized Metro Ticket Inspector / Guard chasing the player at the start and reappearing if the player stumbles on a barrier side-hit.

### 5. UI / UX DESIGN (FORTNITE / SUBWAY SURFERS STYLE)
- **Typography:** Load Google Fonts `Bangers` or `Titan One` (for chunky game titles/scores), `Fredoka` (for clean playful UI), and `Noto Sans Kannada` (for crisp Kannada text).
- **Styling:** Skewed parallelogram containers (`transform: skewX(-10deg)`), thick dark comic outlines, glossy inner highlights, and vibrant Purple/Green/Yellow gradients inspired by Namma Metro lines and Fortnite lobbies.
- **Screens:**
  - **Title / Lobby Screen:** 3D live camera orbiting the idle character standing on the Indiranagar viaduct with an animated metro train passing in the background. Big chunky yellow "PLAY" button, character switcher (1. **Techie Bro** with hoodie, lanyard & backpack; 2. **Indiranagar Skater** with sunglasses & neon jacket; 3. **Classic Auto Anna** with khaki shirt & cool shades).
  - **In-Game HUD:** Top-right skewed Score + Multiplier badge + Token counter; Top-center bilingual Station Arrival toast; Bottom-left active Power-Up circular radial timers; Bottom-right Hoverboard charge button.
  - **Game Over Screen:** Funny Bengaluru-themed crash quips (e.g., *"Missed the Purple Line!"*, *"Swalpa Adjust Maadi!"*, *"Meter Down!"*), score breakdown, High Score (`localStorage`), and instant "RUN AGAIN" button.

### 6. PROCEDURAL AUDIO (WEB AUDIO API)
- Synthesize crisp, zero-asset sound effects using Web Audio API (no external MP3 links that might break):
  - Metro chime ding-dong when entering a station.
  - Pitch-ascending coin/token pickup chimes.
  - Whoosh on lane switch/jump/roll.
  - Auto-rickshaw horn honk on hoverboard activation.
  - Upbeat, funky procedural synth bassline loop with a mute toggle button in the HUD.

Write clean, modular, bug-free code inside the single HTML file. Ensure all 3D models are built procedurally with stylized Three.js primitives (boxes, cylinders, rounded shapes, glowing emissive materials) so there are zero missing textures or broken external asset URLs.
```

---

## 🗺️ PART 2: The 6-Phase Iterative Roadmap (Follow-Up Prompts)

Generating an entire AAA-feeling web game in a single prompt can occasionally cause shortcuts in graphics or physics. After running the Mega Prompt, use these **focused follow-up prompts** in the same Google AI Studio chat to level up each system.

### Phase 1: Physics, Controls & Feel ("Game Juice")
> **Prompt:** *"Let's refine the core movement feel to match Subway Surfers. Add strict input buffering (if I press jump or lane-switch 100ms before landing, execute it immediately on touch-down), add a fast-fall slam when pressing Down mid-air, and add squash-and-stretch scaling to the player mesh on jump and landing. Also ensure train-top running works smoothly: if I jump onto a ramp and land on top of a Namma Metro train, let me run across multiple train roofs and jump between them."*

### Phase 2: Fortnite / Subway Surfers Graphics Overhaul
> **Prompt:** *"Upgrade the visual quality to look closer to Fortnite and Subway Surfers. Add custom procedural canvas textures for the Namma Metro trains (windows, Purple/Green stripes, 'NAMMA METRO' logo), the track sleepers, and the bilingual station signboards so text is crisp on 3D billboards. Add a cel-shaded / stylized rim-light feel using HemisphereLight + DirectionalLight shadows, and add floating dust/sunbeam particles above ground and neon light reflections in the underground tunnels."*

### Phase 3: Seamless Elevated ↔ Underground Transitions
> **Prompt:** *"Enhance the transition between Elevated Viaducts and Underground Tunnels. Build a detailed 3D Tunnel Portal entrance with blinking warning lights and a 'TUNNEL AHEAD / ಸುರಂಗ ಮಾರ್ಗ' sign. As the player enters, smoothly animate the sky color, fog density, and ambient lighting from bright Bengaluru sunshine to sleek underground neon blue/purple lighting, and swap the station pool exclusively to underground stations (Majestic, Cubbon Park, Vidhana Soudha, KR Market) until the next exit ramp."*

### Phase 4: "Peak Bengaluru" Quirks & Dynamic Weather
> **Prompt:** *"Inject more local Bengaluru personality! 
> 1. Add a dynamic weather cycle: occasionally trigger a 'Bengaluru Evening Drizzle' with stylized slanted rain streaks and glossy wet track reflections, or 'Pink Blossom Season' with falling pink Tabebuia petals.
> 2. Add floating comic pop-up text when performing close calls (dodging a train at the last millisecond) showing phrases like 'SWALPA ADJUST!', 'GURU CLOSE CALL!', 'PEAK BENGALURU!', and '1.5x METER!'.
> 3. Upgrade the Auto-Rickshaw Hoverboard model so it looks like a mini futuristic flying Bengaluru auto with glowing neon thrusters."*

### Phase 5: Fortnite-Style Lobby, Shop & Missions
> **Prompt:** *"Upgrade the UI/UX to feel like a polished Fortnite / Subway Surfers menu. Add a 'BENGALURU SHOP' modal where players can spend collected Metro Tokens to unlock:
> - New Characters (Techie Bro, Indiranagar Skater, Auto Anna, Filter Kaapi Master).
> - Hoverboard Skins (Classic Auto, BMTC Volvo Mini, Startup Unicorn).
> - Power-Up Upgrades (increase Filter Kaapi & Masala Dosa Magnet duration).
> Save all unlocks, tokens, and high scores in `localStorage`. Add 3 daily missions (e.g., 'Pass Majestic Station', 'Collect 100 Metro Tokens', 'Drink 2 Filter Kaapis') that increase the permanent Score Multiplier."*

### Phase 6: Bilingual Audio & Polish
> **Prompt:** *"Use the browser's Web Speech API (`window.speechSynthesis`) as an optional toggleable 'Metro Announcer' paired with a synthesized 3-tone Namma Metro chime! When approaching a station, trigger the chime and an optional voice announcement. Also add a performance monitor / Graphics Quality toggle (High / Eco) so it stays locked at 60 FPS on both desktop and mobile devices."*

---

## 🏙️ PART 3: Authentic Bengaluru Reference Bank

Use this cheat sheet whenever you want to feed accurate local details into AI Studio prompts.

### 1. Real Namma Metro Stations (English & Kannada)

| Line | Type | English Name | Kannada Script (`Noto Sans Kannada`) |
| :--- | :--- | :--- | :--- |
| **Purple** | Elevated | Indiranagar | ಇಂದಿರಾನಗರ |
| **Purple** | Elevated | MG Road | ಎಂ.ಜಿ. ರಸ್ತೆ |
| **Purple** | Underground | Cubbon Park | ಕಬ್ಬನ್ ಪಾರ್ಕ್ |
| **Purple** | Underground | Vidhana Soudha | ವಿಧಾನ ಸೌಧ |
| **Interchange** | Underground | Majestic (Kempegowda) | ಮೆಜೆಸ್ಟಿಕ್ (ಕೆಂಪೇಗೌಡ ನಿಲ್ದಾಣ) |
| **Purple** | Elevated | Baiyappanahalli | ಬೈಯಪ್ಪನಹಳ್ಳಿ |
| **Purple** | Elevated | Whitefield (Kadugodi) | ವೈಟ್‌ಫೀಲ್ಡ್ (ಕಾಡುಗೋಡಿ) |
| **Green** | Elevated | Jayanagar | ಜಯನಗರ |
| **Green** | Underground | KR Market | ಕೆ.ಆರ್. ಮಾರುಕಟ್ಟೆ |
| **Green** | Elevated | Mantri Square Sampige Rd | ಮಂತ್ರಿ ಸ್ಕ್ವೇರ್ ಸಂಪಿಗೆ ರಸ್ತೆ |
| **Yellow** | Elevated | Silk Board | ಸಿಲ್ಕ್ ಬೋರ್ಡ್ |
| **Yellow** | Elevated | Electronic City | ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ |

### 2. Official Metro Announcement Phrases (For HUD Toasts)
* **Next Station:** `Next Station: [Name] | ಮುಂದಿನ ನಿಲ್ದಾಣ: [Kannada Name]`
* **Doors:** `Doors will open on the left | ಬಾಗಿಲುಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ`
* **Interchange:** `Interchange for Green Line | ಹಸಿರು ಮಾರ್ಗಕ್ಕೆ ಬದಲಾವಣೆ`

### 3. Quirky "Peak Bengaluru" Pop-Up Text & Billboards
* **Close Call / Near Miss:** *"Swalpa Adjust Maadi!"*, *"One-and-Half Dodge!"*, *"Macha, Close Call!"*
* **Speed Boost:** *"Faster than Silk Board Traffic!"*, *"Filter Kaapi Overdrive!"*
* **Game Over Quips:**
  * *"Auto Anna said 'Won't Come'!"*
  * *"Stuck at Silk Board Junction!"*
  * *"Forgot your Namma Metro Smart Card!"*
  * *"BBMP Dug Up This Track!"*
* **Background Billboards:**
  * *"AI-POWERED MASALA DOSA — SEED FUNDED"*
  * *"MEETING COULD HAVE BEEN A METRO RIDE"*
  * *"SILK BOARD: ETA 4 YEARS"*
  * *"HOT FILTER KAAPI — NEXT EXIT"*

### 4. Color Palette (Fortnite / Subway Surfers Pop)
* **Purple Line Primary:** `#7B2CBF` (Vibrant Electric Purple)
* **Green Line Primary:** `#2DC653` (Neon Emerald Green)
* **Auto-Rickshaw Yellow:** `#FFD60A` (High-Contrast Gold/Yellow)
* **Tabebuia Pink:** `#FF70A6` (Bengaluru Blossom Pink)
* **UI Outline & Shadow:** `#1A1423` (Deep Comic Ink)