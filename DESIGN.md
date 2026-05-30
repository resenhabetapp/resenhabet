# Design System Documentation: Tactical Precision & High-Stakes Energy

## 1. Overview & Creative North Star

### The Creative North Star: "The Tactical Arena"
This design system moves away from the static constraints of traditional utility apps. Instead, it treats sports data, odds, and bets as the pulse of a live event. We are building "The Tactical Arena"—an immersive Dark Mode experience where managing bets and financial conciliation feels less like a spreadsheet and more like a high-end sports command center.

To achieve this, we utilize **high contrast** and **dark tonal depth**. Elements should feel like they are floating in a focused, pressurized environment, using overlapping layers and athletic typography to guide the user's eye through the match data. The mindset is strictly **Mobile First**.

---

## 2. Colors & Surface Architecture

The palette is rooted in a dark, immersive foundation (`surface` in Dark Olive tones), punctuated by ultra-high-performance accents that represent the "action" of the game: Energy and Conversion (`primary` in Electric Neon Green).

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to define sections or containers. Layout boundaries must be established solely through:
1. **Background Color Shifts:** Placing a `surface-container-low` element against a `surface` background.
2. **Tonal Transitions:** Using the hierarchy of `surface-container` tokens to imply separation.

### Surface Hierarchy & Nesting
Think of the UI as physical layers of dark acrylic or matte asphalt.
* **Base:** `surface` (Deep Dark Olive - #0f1412)
* **Level 1 (Sections):** `surface-container-low` (Dark Olive - #161e1a)
* **Level 2 (Cards/Bets):** `surface-container` (Grayish Olive - #1c2722)
* **Level 3 (Floating Actions/Modals):** `surface-container-highest` (Metallic Olive - #273831)

### The "Neon Glow" Rule
To escape the "flat" look in dark mode, we use **Colored Glows** for action elements.
* **Implementation:** For main CTAs (like "Buy Tokens" or "Confirm Bet"), apply a diffused outer shadow with the `primary` color (#39FF14) at low opacity (10-20%) to create a "glow" that feels premium and electric.

---

## 3. Typography: The Broadcast Voice

We pair the technical readability of **Inter** with the structural, athletic character of **Space Grotesk** (Athletic White).

* **Display & Headlines (Space Grotesk):** Use `display-lg` to `headline-sm` for high-impact data (e.g., Scores, Bet Values, Dynamic Cents). The sharp terminals of Space Grotesk convey a "futuristic" and "technical" aesthetic. Color: `on-surface` (Athletic White - #F8F9FA).
* **Body & Navigation (Inter):** Use `title-lg` down to `body-sm` for all functional reading. Inter provides the clarity required for signup forms and prize pool rules.
* **Information Hierarchy:** Always lean into high-contrast scale. If a headline is `headline-lg`, the supporting label should be `label-md` to create an editorial "white space" around the content, which is essential on mobile screens.

---

## 4. Elevation & Depth

We define hierarchy through **Tonal Layering** and **Glows**, not structural scaffolding.

* **The Layering Principle:** Depth is achieved by stacking. A `surface-container` card on a `surface` background creates a natural lift.
* **Background Shadows:** For floating elements (like mobile Bottom Sheets), use extra-diffused shadows with pure black (#000000) at 40-60% opacity to detach the element from the olive base.
* **The "Ghost Border" Fallback:** If a bet container absolutely requires a boundary for accessibility, use the `outline-variant` (#2e4238) at **10-20% opacity**.

---

## 5. Components

### Buttons & Interaction
* **Primary (Critical Action):** `primary` background (Electric Neon Green - #39FF14) with `on-primary` text (Black/Very Dark Olive for maximum contrast). Apply a subtle neon glow on hover/active states.
* **Secondary (Support):** Transparent background with a ghost border and Athletic White text.
* **Tertiary:** Transparent background with `primary` text.

### Data Chips & Status
* **High-Contrast Status:** Status indicators (e.g., "Pix Confirmed", "Room Closed") must use pastel or blocked variants from the error palette (`error_container`), ensuring maximum legibility against the dark background.

### Inputs & Forms (Mobile First)
* **The Clean Input:** No bottom line or solid box. Use a `surface-container-low` background with an `outline-variant` ghost border. Inputs must be at least `44px` high to facilitate touch targets on mobile.
* **Focus State:** Transition the border to a 2px `primary` (Neon Green) stroke.

### Cards & Participant Lists
* **Rule:** Forbid the use of divider lines.
* **Separation:** Use a `spacing-4` (1rem) vertical gap or a background shift for individual items.

---

## 6. Do’s and Don’ts

### Do:
* **Do:** ALWAYS think about the mobile screen first. The layout must be fluid and tactile.
* **Do:** Use `Space Grotesk` for all numbers, scores, and financial data to emphasize the technical aspect of the sport.
* **Do:** Use the Spacing Scale strictly to keep the interface breathing.

### Don’t:
* **Don’t:** Use 100% opaque gray borders. It breaks the "Tactical Arena" immersion.
* **Don’t:** Mix too many bright colors. Electric Neon Green should be the only primary point of attention.
* **Don’t:** Use white or light "Drop Shadows". If an element doesn't feel floating through a tonal shift, reconsider the hierarchy before forcing an unrealistic shadow.