# SLEEPER CELL — MVP Build Blueprint (v2)

A mobile-first, QR-join, real-time multiplayer Mafia/Civilian social deduction game with live voting.

This document is written to be handed directly to an AI coding agent (Claude Code, Cursor, etc.) as a full implementation spec. It contains architecture, data models, screen flows, and exact behavioral rules. Where a decision was made on the user's behalf, it's flagged as **[ASSUMPTION]** so it can be revisited. Confirmed product decisions (made by the user directly) are flagged as **[CONFIRMED]**.

---

## 1. Concept Summary

Sleeper Cell is a party game for in-person groups. One player is the **Host**. The Host creates a Room, which generates a short Room Code and a QR code. Other players (**Joiners**) either type in the Room Code or scan the QR code with an in-browser camera scanner to join the room's waiting lobby.

Once enough players have joined, the Host configures game settings (player count, Mafia count, and phase timers) and starts the game. A synchronized 3-2-1 countdown plays on every device simultaneously, after which each player's screen privately reveals their own secret role (Mafia or Civilian).

The game then proceeds in rounds. Each round has a **Discussion phase** (players talk in person about who they suspect) followed by a **Voting phase** (everyone — including Mafia — votes on who they believe is Mafia, with live-visible results and unlimited vote-changing until the timer ends). Whoever gets the most votes is eliminated; a tie is broken by secure random selection among the tied players. The game ends when either all Mafia are eliminated (**Civilians win**) or Mafia count reaches parity with remaining Civilians (**Mafia wins**). Only the Host can start, reset, or end the game.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React 18 + Vite** | Required for ReactBits compatibility; fast dev loop |
| UI animation/component library | **ReactBits** (reactbits.dev) | Used for backgrounds, text reveal animations, buttons, vote-tally transitions |
| Styling | **Tailwind CSS** | Pairs cleanly with ReactBits, fast for mobile-first work **[ASSUMPTION]** |
| Realtime backend | **Firebase Realtime Database** | Serverless, real-time listeners, no infra to manage **[ASSUMPTION]** — Socket.io+Node is the alternative |
| QR code generation | **`qrcode.react`** | Renders room-join URL as a QR code component |
| QR code scanning | **`html5-qrcode`** | Camera permission + live QR decode, mobile-friendly |
| Secure randomization | **Web Crypto API** (`crypto.getRandomValues`) | Used for both role assignment AND tie-break elimination — never `Math.random()` |
| Returning-player recognition | **Browser `localStorage` / cookies** | Persists player identity + display name across sessions, see Section 9 |
| Hosting | **Vercel** or **Firebase Hosting** | Free, trivial deploy for a Vite/React app |

---

## 3. Full Game Loop

```
lobby → countdown → reveal → discussion → voting → elimination_reveal
                                  ↑_____________________________|
                                  (loop back to discussion for next round,
                                   unless a win condition is met)
                                                      ↓
                                              game_over → (host resets) → lobby
```

### Phase-by-phase behavior

1. **lobby** — Players join, Host configures settings. See Section 5.
2. **countdown** — Synced 3-2-1 (see Section 3.1 in original spec — server-timestamp-driven, not local `setTimeout`).
3. **reveal** — Each player privately sees their own role card. **[CONFIRMED]** Mafia players additionally see the names of their fellow Mafia on this same screen (e.g., "You are Mafia. Your fellow Mafia: Priya, Sam." beneath the role card) — Civilians see only their own role with no additional names, since they have no teammates to be aware of. This requires the server-side role assignment step (Section 6 of the original spec) to also write each Mafia player's teammate list, or for the client to compute it locally from the full room roster filtered to `role === "mafia"`, excluding the requesting player's own ID — the latter is simpler but means the full Mafia list briefly exists in a Mafia player's client memory, which is an acceptable tradeoff at MVP scope since it's the same population who already knows their own role. Host taps "Begin Discussion" to advance (not automatic — gives the group a moment to actually look at their phones before diving in).
4. **discussion** — Timer counts down (Host-configurable, see Section 5). All players see a shared "Discussion in progress" screen with the live timer and the current round number. No voting UI yet — this phase is for in-person talking, not app interaction.
5. **voting** — Timer counts down (separately configurable from discussion). Every player, including Mafia, sees a list of all currently-alive players (excluding themselves — you cannot vote for yourself) and taps to cast/change their vote. See Section 4 for full voting rules.
6. **elimination_reveal** — Timer ends → votes tally → eliminated player determined (with tie-break logic per Section 4.2) → short animated reveal shown to everyone: the eliminated player's name and role are revealed to the full group (this is standard genre convention — eliminated players' roles become public knowledge, unlike the private role reveal at game start). Eliminated player's own screen transitions to the **locked/eliminated state** (Section 4.3).
7. Win condition check runs automatically after every elimination (Section 6). If no win condition met, loop back to **discussion** for the next round (**[CONFIRMED]** rounds share the same structure and timer settings — there is no "first argument vs second argument" differentiated timer, just one repeatable Discussion timer and one repeatable Voting timer applied every round).
8. **game_over** — Full role reveal for all players (who was Mafia, who was Civilian, vote history optional stretch goal), winning team banner, "Play Again" button (Host-only — see Section 7).

---

## 4. Voting System

### 4.1 Core Rules **[CONFIRMED]**
- Every living player votes, **including Mafia players** — Mafia voting is what makes them blend in; hiding them from voting would out them instantly.
- A player cannot vote for themselves.
- Votes are **changeable at any time until the voting timer hits zero** — tapping a different player simply overwrites your previous vote in the DB.
- Vote tally is **live and visible to everyone** during the voting phase **[CONFIRMED]** — every vote change should propagate to all screens in near-real-time (Firebase `onValue` listener on the room's votes object). This is a deliberate tension-building choice: watching the tally shift live is a core "fun" mechanic of this genre, and it also means bandwagon/anti-bandwagon voting becomes a real strategic layer.
- Eliminated players do not vote in subsequent rounds (their vote weight is removed from the pool).

### 4.2 Tie-Break: Random Elimination **[CONFIRMED]**
If two or more players are tied for the most votes when the timer ends, use the **same secure Fisher-Yates-derived randomness** already used for role assignment (Section 6 of original spec) to pick one of the tied players:

```javascript
function resolveTiedVote(tiedPlayerIds) {
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const index = randomBuffer[0] % tiedPlayerIds.length;
  return tiedPlayerIds[index];
}
```

This should run server-side (Cloud Function) alongside the vote tally at the moment the timer expires, for the same fairness/anti-tampering reason server-side role assignment is recommended.

The elimination_reveal screen should explicitly indicate when a tie occurred and was broken randomly (e.g., "It was a tie — fate decided." with a brief dice/coin-flip style animation) so the group understands why that specific person was chosen rather than assuming manipulation.

### 4.3 Eliminated Player Experience **[CONFIRMED]**
When a player is eliminated:
- Their screen transitions to a distinct **locked/eliminated state**: visually dimmed/darkened UI, all interactive voting/discussion controls removed.
- They retain access to view their **own role card** (a persistent, non-interactive element on their locked screen — e.g., "You were: MAFIA" with the same styling as the original reveal) so they have something to show the group as proof, but cannot rejoin voting or influence the remaining game.
- They remain visible in the room's player list (marked with an "eliminated" tag/strikethrough/skull icon) so remaining players can see who's out, but the eliminated player's client no longer writes any game-state data.
- **[CONFIRMED]** Eliminated players CAN watch the live vote tally in later rounds as spectators — same real-time tally feed as living players, but with no vote button and no ability to select a name. This keeps them engaged in the room without letting them influence the outcome. Their screen is best thought of as "locked for input, open for viewing" rather than fully dark — the own-role-card view and the live spectator tally can share the same locked-state screen (e.g., a toggle or scroll between "Your Role" and "Live Tally").

---

## 5. Host Settings Panel (Expanded)

The Settings panel, editable by Host only, before "Start Game" is tapped:

| Setting | Type | Notes |
|---|---|---|
| Total Players | Number stepper | Auto-synced to actual joined count, can be set lower to require a minimum before Start is enabled |
| Mafia Count | Number stepper | Validated: `1 ≤ mafiaCount < totalPlayers` |
| Discussion Timer | Number stepper (seconds/minutes toggle) + **"Unlimited" switch** | **[CONFIRMED]** fully configurable, no fixed default mandated — exact default value left to the builder/host's discretion. When "Unlimited" is toggled on, `discussionEndsAt` is not set and the phase only advances via Host tap ("Begin Voting"), never automatically. |
| Voting Timer | Number stepper + **"Unlimited" switch** | **[CONFIRMED]** same pattern as Discussion — when unlimited, voting only resolves when the Host manually taps "End Voting," which triggers the same tally/tie-break logic that a timer expiry would have triggered. |
| Sound Effects | Toggle | On/off for vote-tick sounds, elimination stings, etc. (Section 8) |

**[CONFIRMED]** Rounds themselves are structurally identical — one Discussion timer + one Voting timer setting applies to every round of a given game; there is no separate "round 1 timer vs round 2 timer" configuration, since the user confirmed rounds should stay "similar only."

**[CONFIRMED]** Both timers support an "Unlimited" mode as an alternative to a fixed duration, controlled per-setting by a toggle switch next to each stepper. This requires the phase-advance logic (Section 3, steps 4–6) to branch: if a timer is set, advance automatically via the server-timestamp mechanism (Section 3.1 of the original spec); if unlimited, advance only on an explicit Host action ("Begin Voting" / "End Voting" buttons, visible only to Host, appearing in place of the countdown display for that phase).

All settings should be re-editable if the Host resets the game (Section 7) — settings do not need to be re-entered from scratch, they persist as the last-used values in the room doc until explicitly changed.

---

## 6. Win Conditions

Checked automatically by the server (Cloud Function) immediately after every elimination_reveal resolves:

- **Civilians win** when the Mafia count among living players reaches 0.
- **Mafia win** when the number of living Mafia is **greater than or equal to** the number of living Civilians (standard Mafia/Werewolf win condition — once Mafia can outvote Civilians in any future round, Civilians can no longer mathematically win).

On win, phase moves directly to `game_over` regardless of whether the Voting timer would otherwise continue — no further rounds are needed once a condition is met.

---

## 7. Reset & Replay

- **Reset Game** (Host-only, available at any phase after `lobby`): immediately returns `phase` to `lobby`, clears all `role`, `vote`, and `eliminated` fields on every player, but **retains the player roster and last-used settings** so the Host doesn't have to re-invite everyone or re-configure timers for a rematch.
- **[ASSUMPTION]** Add a distinct **"Play Again"** button on the `game_over` screen specifically (separate from a generic mid-game "Reset") that does the same underlying reset but is framed as a natural next step rather than an abort — this is a small but meaningful UX distinction for a game meant to be played in repeated rounds over a hangout session.
- A full **"End Session / New Room"** option should also exist for the Host to abandon the current room entirely and create a fresh one (e.g., if the group composition changes significantly).

---

## 8. Professional Polish Layer

These are additions beyond the core loop that meaningfully increase perceived quality and replay-fun without expanding the core scope irresponsibly. Recommend building these after the core loop (Section 11 build order) is fully working end-to-end.

- **Sound design** — short, tasteful audio stings for: countdown ticks, role reveal (a "sting" that differs subtly for Mafia vs Civilian reveal, without being audible to nearby players — i.e., avoid anything that could be overheard and give away a role), vote cast, elimination reveal, win/lose fanfare. Must be toggleable (Section 5) and should never autoplay loudly on load.
- **Haptic feedback** (mobile) — short vibration pulse on role reveal, vote cast, and elimination, using the Vibration API where supported. Cheap to add, disproportionately satisfying on phones.
- **Player avatars** — auto-assigned colored initials/icon per player (no upload needed) so the player list and voting screen are visually scannable at a glance rather than a plain text list.
- **Live "who's voted" indicator** — separate from the vote tally itself, show a simple checkmark/pending state per player during the voting phase ("5 of 7 have voted") to build anticipation as the timer runs down, without revealing WHO they voted for until you want the full tally shown (in this build, tally is already live/visible per Section 4.1, so this doubles as a visual pacing element).
- **Animated transitions between every phase** — ReactBits-driven fade/slide/reveal transitions so phase changes (lobby→countdown→reveal→discussion→voting→elimination) never feel like a jarring page reload. This is where ReactBits earns its place in the stack.
- **End-game recap** — full role list for every player plus a simple round-by-round elimination timeline ("Round 1: Sam voted out — was Civilian. Round 2: Priya voted out — was Mafia.") on the `game_over` screen. High perceived-value addition for relatively low build cost since the data is already being tracked.
- **PWA installability** — add a web app manifest + service worker so the game can be "Added to Home Screen" on mobile and opens full-screen without browser chrome, which reads as significantly more polished/professional than a bare mobile website for a game meant to be reopened repeatedly.
- **Graceful disconnect/reconnect handling** — if a player's browser refreshes or loses connection mid-game, their `localStorage`-persisted `playerId` should let them rejoin their exact seat (same role, same vote state) rather than being treated as a brand-new joiner. Critical for a real-world usage pattern where people fumble their phones mid-game.
- **Empty/error states** — invalid room code, room already started (late joiners should be told clearly why they can't enter, not just silently fail), Host disconnecting mid-game (**[ASSUMPTION]** recommend: if Host disconnects, the game pauses with a "Host reconnecting..." banner rather than ending the room outright, since Host reconnecting via the same persisted `playerId` should restore control seamlessly).

---

## 9. Returning-Player Recognition (Cookies / localStorage) **[CONFIRMED]**

The user explicitly wants the app to recognize returning players so no repeated onboarding/tutorial friction is needed. Implementation:

- On first visit, generate a persistent `playerId` (UUID) and store it in `localStorage` alongside the player's last-used **display name**.
- On any future visit (new room, same browser/device), pre-fill the name-entry field with their last-used name rather than presenting a blank field — they can still edit it, but the friction of retyping a name every single game night is removed.
- Because the interface should be self-explanatory (per the user's explicit "no tutorials needed" requirement), avoid building a forced onboarding walkthrough at all — instead, rely on:
  - Clear, short, plain-language button labels ("Create Room" / "Join Room" / "Scan QR" — no jargon)
  - Inline empty-states that explain themselves contextually (e.g., an empty player list before anyone joins reads "Waiting for players to join..." rather than just being blank)
  - Obvious visual hierarchy (Section 10) so the correct next action is always the most visually prominent element on screen
- **[ASSUMPTION]** A first-time-only, single-line contextual hint (not a modal, not a multi-step tour) may still be appropriate in exactly one place: the very first time a player reaches the Role Reveal screen, a small fading caption like "Tap to keep viewing — only you can see this" reassures them the app isn't broken/frozen. This respects "no tutorials" while covering the one moment where user confusion is most likely (a full-screen static card with no visible buttons can look like a loading error to someone who's never seen it before). Stored as a `hasSeenRoleRevealHint` flag in `localStorage` so it never shows twice.

---

## 10. Visual Design Direction **[CONFIRMED]**

Exact brand palette, confirmed by product owner:

| Token | Hex | RGB | Role |
|---|---|---|---|
| Background base (dark) | `#272121` | `rgb(39, 33, 33)` | App background, darkest surface — replaces near-black |
| Surface / card | `#443737` | `rgb(68, 55, 55)` | Cards, elevated panels, phone-frame chrome, input fields, inactive elements |
| Primary accent (danger/Mafia) | `#FF0000` | `rgb(255, 0, 0)` | Mafia role card, elimination reveal accents, danger states, vote-tally bars |
| Secondary accent (energy/CTA) | `#FF4D00` | `rgb(255, 77, 0)` | Primary interactive buttons, active timers, countdown numbers, "Start Game"-class CTAs — kept distinct from the pure-red Mafia color so danger states and action states never get visually confused |

Usage rules:
- `#272121` is the base canvas everywhere — this replaces the generic "near-black" language from the original draft with an exact warm, slightly brown-toned dark rather than a cold pure black, which reads warmer and more "underground/noir" than a flat `#000000` would.
- `#443737` is used for anything that needs to sit visibly above the background without competing for attention — cards, the phone-frame bezel in mockups, list rows, unselected vote targets, input fields.
- `#FF0000` is reserved specifically for Mafia/danger meaning — the Mafia role reveal card, the "eliminated" badge type on the elimination reveal screen, live vote-tally bars (since voting is inherently about identifying danger), and any other place red already carried semantic meaning in the original draft.
- `#FF4D00` is reserved for interactive/action meaning — primary buttons (Start Game, Begin Discussion, Play Again), the countdown numbers, active timer displays. Keeping this visually distinct from `#FF0000` matters functionally: a player should never wonder whether a red element is "something dangerous happening" versus "something I can tap."
- Civilian-associated UI uses a neutral/off-white text tone against the `#272121`/`#443737` base rather than introducing a fifth brand color — **[ASSUMPTION retained]** exact off-white hex (e.g. `#F2EFE9`) left to the builder's discretion for AA contrast compliance against the dark background.
- Every full-screen phase transition should feel intentional (see Section 8 ReactBits transitions), not like separate disconnected pages.
- Motion should be purposeful, not decorative-for-its-own-sake — favor a small number of well-executed signature moments (the countdown, the role reveal flip/fade, the elimination reveal) over animating everything.
- Consistent type scale: one display font for big moments (room code, countdown numbers, role reveal), one clean readable font for body/lists — avoid more than two typefaces total.

---

## 11. Updated Data Model (Firebase Realtime Database shape)

```
/rooms/{roomCode}/
  hostId: string
  phase: "lobby" | "countdown" | "reveal" | "discussion" | "voting" | "elimination_reveal" | "game_over"
  createdAt: timestamp
  countdownStartsAt: timestamp | null
  currentRound: number
  discussionEndsAt: timestamp | null      // server-timestamp driven, same sync pattern as countdown
  votingEndsAt: timestamp | null
  winner: "mafia" | "civilians" | null
  settings: {
    totalPlayers: number
    mafiaCount: number
    discussionSeconds: number
    votingSeconds: number
    soundEnabled: boolean
  }
  players/
    {playerId}/
      name: string
      isHost: boolean
      joinedAt: timestamp
      role: "mafia" | "civilian" | null
      isAlive: boolean
      hasVoted: boolean               // per-round flag, reset each voting phase
      votedFor: playerId | null       // per-round, reset each voting phase, changeable until timer ends
  eliminationHistory/
    {round}/
      eliminatedPlayerId: string
      eliminatedRole: "mafia" | "civilian"
      wasTie: boolean
      voteCounts: { [playerId]: number }   // for end-game recap, Section 8
```

Notes:
- `votedFor` is intentionally readable by all clients during the voting phase (this is what powers the live/visible tally per Section 4.1) — this is a deliberate exception to the "don't expose sensitive state" pattern used for roles, and should be clearly separated in security rules from the `role` field, which must remain readable only by the owning player's client (and never by others) at all times except during `elimination_reveal`/`game_over`, when a player's own role becomes intentionally public per Section 3 step 6.
- `hasVoted` exists as a lightweight boolean separate from `votedFor` so the UI can show "X of Y have voted" progress without necessarily parsing the full vote map, though since the tally is fully live/visible here anyway this is mostly a convenience field.

---

## 12. Updated Screens / Components

1. Landing Screen
2. Create Room Screen (Host)
3. Join Room Screen (code entry / QR scan toggle)
4. Name Entry Screen (pre-filled from `localStorage` for returning players, Section 9)
5. Waiting/Lobby Screen
6. Host Settings Panel (now includes Discussion/Voting timers, Section 5)
7. Countdown Screen
8. Role Reveal Screen (with first-time-only hint caption, Section 9)
9. **Discussion Screen** (new) — round number, live countdown, no interactive voting UI yet, "Skip to Vote" button for Host only **[ASSUMPTION]** in case discussion wraps up early
10. **Voting Screen** (new) — list of alive players (self excluded), tap to vote/change vote, live tally per player, countdown timer, "X of Y have voted" indicator
11. **Elimination Reveal Screen** (new) — animated reveal of who was eliminated + their role, tie-break dice-roll animation when applicable
12. **Eliminated/Locked Screen** (new) — dimmed UI, persistent view of own role card, no interactive controls
13. **Game Over Screen** (new) — winning team banner, full role list, round-by-round recap, "Play Again" and "End Session / New Room" buttons (Host-only for both)
14. Host Controls (persistent overlay during active game) — "Reset Game" (with confirm step), visible only to Host

---

## 13. Host-Only Permission Rules (Updated)

In addition to the original create/settings/start/reset permissions, the Host now also exclusively controls:
- Advancing from `reveal` → `discussion` (the "Begin Discussion" tap)
- Optionally skipping early from `discussion` → `voting` (Section 12, item 9)
- The `game_over` → `lobby` transition via "Play Again"
- Ending the room entirely via "End Session / New Room"

All of these must be enforced in backend security rules (checking `hostId` against the requesting `playerId`), not just hidden in the UI — same reasoning as the original spec's Section 8.

---

## 14. Explicit Scope Boundaries (Updated)

**Now in scope for MVP (added this revision):**
- Full voting system with live tally, changeable votes, secure random tie-break
- Configurable Discussion and Voting timers (Host settings)
- Multi-round game loop with win-condition checking
- Elimination reveal + locked eliminated-player state
- Game Over screen with recap
- Returning-player recognition via localStorage (no repeated onboarding)
- Sound effects, haptics, PWA installability, disconnect/reconnect handling (Section 8)

**Still explicitly OUT of scope for this MVP:**
- Special roles beyond binary Mafia/Civilian (Doctor, Detective, etc.) — noted as a natural v2 expansion given the round/vote infrastructure now being built supports it structurally
- In-app text/voice chat (discussion remains verbal/in-person by design)
- Persistent user accounts/login beyond local device recognition
- Spectator mode for eliminated players beyond their own locked role card
- Multiple simultaneous game modes/rule variants — one ruleset (Mafia vs Civilian, majority-vote elimination) for this MVP

---

## 15. Updated Suggested Build Order

1. Scaffold Vite + React + Tailwind + Firebase SDK.
2. Firebase project + Realtime Database + security rules (Section 13).
3. Room creation + join flow (manual code first, QR after).
4. Lobby with live player list.
5. Host Settings panel including new timer fields (Section 5).
6. Secure role assignment (`secureShuffle`) wired to "Start Game."
7. Synced countdown.
8. Role Reveal screen.
9. **Discussion screen + server-timestamp-driven timer.**
10. **Voting screen: cast/change vote, live tally, hasVoted indicator.**
11. **Vote resolution logic (Cloud Function): tally votes, detect ties, run `resolveTiedVote`, write `eliminationHistory` entry, update `isAlive`.**
12. **Elimination Reveal screen + eliminated/locked player state.**
13. **Win-condition check (Cloud Function) + Game Over screen with recap.**
14. **Round loop: elimination_reveal → discussion (increment `currentRound`) unless win condition met.**
15. Reset Game + Play Again flows (Section 7).
16. QR generation + camera scanning.
17. ReactBits polish pass on all transitions.
18. Sound design + haptics (toggleable).
19. localStorage returning-player pre-fill + first-time role-reveal hint.
20. PWA manifest + service worker.
21. Disconnect/reconnect handling + error/empty states.
22. Full mobile device testing pass — pay particular attention to the live-vote-tally re-render performance on lower-end Android devices with many players in the room, since this is now a real-time-heavy screen rather than a static one.

---

## 16. Confirmed Product Decisions (Final)

All previously open questions have now been confirmed directly by the product owner:

- **Mafia teammate awareness: CONFIRMED YES** — Mafia players see each other's names on the Role Reveal screen (Section 3, step 3).
- **Host role: CONFIRMED** — the Host plays the game and receives a role like any other player; there is no pure-moderator mode in this MVP.
- **Timers: CONFIRMED fully configurable with an Unlimited option** — no fixed default duration is mandated by the product owner; both Discussion and Voting timers include a per-setting "Unlimited" toggle that switches phase advancement from automatic (timer expiry) to manual (Host button tap). See Section 5.
- **Minimum player count to start: CONFIRMED none** — the Host can tap "Start Game" at any player count, including counts that may make the Mafia/Civilian math trivial or unbalanced (e.g., 2 players). No validation floor is enforced beyond the existing `1 ≤ mafiaCount < totalPlayers` rule in Section 5 — the Host is trusted to use sensible settings for their group size.
- **Room expiry: CONFIRMED auto-delete after a few hours of inactivity** — implemented as a scheduled Cloud Function (or equivalent cron) that removes room documents whose `createdAt`/last-activity timestamp exceeds a threshold. **[ASSUMPTION retained: exact threshold, e.g. 6 hours, left to the builder's discretion since an exact number wasn't specified — safe to pick anywhere in a 4–8 hour range.]**
- **Eliminated player spectator access: CONFIRMED yes to live tally, no to voting** — see the updated Section 4.3.

No further open product questions remain for this MVP scope as of this revision. Any additional decisions that come up during implementation (e.g., exact color hex values, exact copy/microcopy wording, exact animation timing curves) are left to the builder's creative discretion within the direction set by Section 10.
