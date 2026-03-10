# 🚀 Alex — Anonymous Communication Hub

> **Futuristic anonymous communication for communities.**
> Real-time chat, P2P private messaging, voice/video calls, and large meetings — all without accounts, registration, or tracking.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
[![Made with Supabase](https://img.shields.io/badge/Realtime-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![WebRTC](https://img.shields.io/badge/P2P-WebRTC-orange)](https://webrtc.org)
[![Jitsi](https://img.shields.io/badge/Meetings-Jitsi-97979A)](https://jitsi.org)

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features](#2-features)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [How It Works](#5-how-it-works)
   - [Rocket Identity System](#51-rocket-identity-system)
   - [Token Identity System](#52-token-identity-system)
   - [Secret Phrase Recovery](#53-secret-phrase-recovery)
   - [Public Chat Architecture](#54-public-chat-architecture)
   - [Private P2P Chat Flow](#55-private-p2p-chat-flow)
   - [WebRTC Connection Flow](#56-webrtc-connection-flow)
   - [Meeting Room Integration](#57-meeting-room-integration)
6. [Deployment Guide](#6-deployment-guide)
   - [Step 1 — Create GitHub Repository](#step-1--create-github-repository)
   - [Step 2 — Configure Supabase](#step-2--configure-supabase)
   - [Step 3 — Update App Config](#step-3--update-app-config)
   - [Step 4 — Deploy to Vercel](#step-4--deploy-to-vercel)
7. [Local Development](#7-local-development)
8. [Supabase Setup (Detailed)](#8-supabase-setup-detailed)
9. [Troubleshooting](#9-troubleshooting)
10. [FAQ](#10-faq)
11. [Security & Privacy Notes](#11-security--privacy-notes)

---

## 1. Project Overview

**Alex** is a zero-account anonymous communication platform built for small communities — classrooms, study groups, friend groups, or collaborative teams.

Everything runs in the browser. Users are identified by procedurally-generated **rocket avatars** and optional **communication tokens** for private messaging. No email. No password. No data stored on a server beyond what's absolutely necessary for real-time delivery.

The platform is fully deployable for free using:
- **GitHub** — source code hosting
- **Vercel** — frontend hosting (free tier, zero config)
- **Supabase** — real-time channel infrastructure (free tier)
- **Jitsi Meet** — large meeting rooms (free, open source)

---

## 2. Features

| Feature | Description | Technology |
|---|---|---|
| **Public Chat** | Anonymous real-time messaging in named rooms | Supabase Realtime Broadcast |
| **Private Chat** | Token-based P2P encrypted messaging (no server logs) | WebRTC DataChannel |
| **Voice Call** | Audio-only peer calls, up to 4 participants | WebRTC |
| **Video Call** | Video + mic + screen sharing, up to 4 participants | WebRTC |
| **Meeting Room** | Large-scale meetings for 30–50 participants | Jitsi Meet External API |
| **Rocket Identity** | Procedural SVG avatar generated from username seed | Canvas / SVG |
| **Token Identity** | Cryptographically unique communication ID, stored locally | Web Crypto API |
| **Phrase Recovery** | Restore token identity using 3 secret words | SHA-256 deterministic |
| **Custom Cursor** | Futuristic space-station cursor (desktop) | CSS + JS |
| **Cinematic Loading** | Starfield, nebula, animated progress bar | Canvas + CSS |

---

## 3. Technology Stack

```
Frontend
├── HTML5          — single-file page (index.html)
├── CSS3           — custom design system (css/main.css)
└── Vanilla JS     — all logic in one bundle (js/app.js)

Real-time Infrastructure
├── Supabase Realtime — broadcast channels for public chat
│                       and WebRTC signaling
└── WebRTC            — peer-to-peer for private chat,
                        voice, and video calls

Large Meetings
└── Jitsi Meet External API — embedded iframe, loaded on demand

Hosting
├── GitHub   — source control
└── Vercel   — static site hosting (zero-config deploy)
```

**Why this stack?**
- Zero backend server to maintain
- Zero database migrations required
- Zero cost on free tiers for small communities
- Deploys in under 2 minutes

---

## 4. Project Structure

```
alex-anonymous-platform/
│
├── index.html          ← Entire HTML application (all screens)
├── css/
│   └── main.css        ← Complete stylesheet (design system, animations)
├── js/
│   └── app.js          ← Complete application bundle (all logic)
│
├── README.md           ← This file
└── vercel.json         ← (optional) Vercel config for custom routing
```

> **Note:** This is intentionally a minimal, single-page structure. No build tools, no node_modules, no bundler required. It works directly from a file server or CDN.

---

## 5. How It Works

### 5.1 Rocket Identity System

When a user enters their call sign (username), the app generates a **procedural rocket avatar** using a seeded pseudo-random number generator (PRNG).

**How it's generated:**
1. The username string is hashed using the `djb2` algorithm to produce a numeric seed.
2. The `Mulberry32` PRNG is initialised from that seed.
3. The PRNG deterministically picks:
   - Body color (from a curated space-grade palette)
   - Flame color
   - Window color
   - Wing shape (3 styles)
   - Stripe pattern
   - Fin shape
4. A unique **Rocket ID** code is generated (e.g. `RKT-7A3`).
5. The rocket is rendered as an inline SVG — no image files needed.

The same username will always produce the same rocket on any device. The rocket floats subtly using a CSS animation.

---

### 5.2 Token Identity System

In addition to the rocket avatar, each user receives a **Communication Token** — a cryptographically random, globally unique identifier used for private P2P messaging.

**Token format:**
```
u_xxxxxxxxxxxxxxxxx
```
Example: `u_8dj29sjs8s2kql7`

**How it works:**
- Generated using `crypto.getRandomValues()` via the Web Crypto API.
- Stored only in the user's browser (`localStorage`).
- Never sent to any server.
- Used as the identity key for WebRTC signaling when initiating private chats.

> **Important:** The token is local to the device. If the user clears their browser storage without saving their recovery phrases, the token is permanently lost.

---

### 5.3 Secret Phrase Recovery

To allow identity recovery across devices or after clearing browser storage, the app generates **3 secret recovery phrases** from a wordlist of 256 memorable words.

**Example phrases:** `shadow mango comet`

**How recovery works:**
1. The 3 phrases are concatenated in order: `"shadow mango comet"`
2. This string is passed through `SHA-256` (Web Crypto API).
3. The resulting hash is used as a deterministic seed to recreate the same token.
4. No server is involved — recovery is 100% client-side.

**Security note:** The phrases are shown once during identity creation. The user must save them manually (screenshot, write down, or copy). The app explicitly warns about this.

---

### 5.4 Public Chat Architecture

Public chat uses **Supabase Realtime Broadcast channels** — not a database table.

```
User A                    Supabase Realtime              User B
  │                             │                           │
  │── broadcast "msg" ─────────>│────── forward ──────────>│
  │                             │                           │
  │<─────────────────────────────── NOT echoed back ────────│
```

**Key design choices:**
- Messages are **broadcast-only** — they are never stored in a database table. This means no database setup, no migrations, and no chat history persists after you leave the room.
- **Presence tracking** is used to show the online count in the room header.
- **Typing indicators** are broadcast events with a 2.8-second debounce timeout.
- Each message carries a unique UUID to prevent duplicate rendering.
- The DOM prunes messages beyond 200 entries to prevent memory bloat.

**What you need in Supabase:** Just a project with Realtime enabled. No table creation required for public chat.

---

### 5.5 Private P2P Chat Flow

Private messaging travels **directly between two browsers** using WebRTC DataChannels. The message never passes through any server.

**Connection flow:**

```
Step 1: User A opens Private Chat, enters User B's token.

Step 2: App computes a deterministic room ID:
         room_id = SHA-256(sort([tokenA, tokenB]).join(''))
         → e.g.  "p2p_82ks82ks..."

Step 3: Both users subscribe to the same Supabase Realtime
        channel for that room_id. This is the signaling channel.

Step 4: The first user to connect becomes the "offerer".
        They create a WebRTC PeerConnection and DataChannel.

Step 5: Offerer creates an SDP Offer and publishes it to
        the signaling channel.

Step 6: The second user ("answerer") receives the offer,
        creates an SDP Answer, and publishes it back.

Step 7: Both sides exchange ICE candidates via the same
        signaling channel.

Step 8: WebRTC completes the connection (DTLS handshake).
        The DataChannel opens.

Step 9: ALL further messages travel through the DataChannel.
        The signaling channel is no longer used.
```

**The signaling channel role:**  
Supabase Realtime is only used during the connection handshake (steps 5–7). After the DataChannel is open, Supabase is out of the picture entirely.

**What gets stored on Supabase:** Nothing. Signaling messages are broadcast-only and expire immediately.

---

### 5.6 WebRTC Connection Flow

Both the Private Chat and Voice/Video Call systems use the same underlying WebRTC architecture.

```javascript
// 1. Create peer connection with ICE servers
const pc = new RTCPeerConnection({ iceServers: CONFIG.ICE_SERVERS });

// 2. Handle ICE candidates
pc.onicecandidate = ({ candidate }) => {
  if (candidate) signalingChannel.send({ type: 'ice', candidate });
};

// 3. Create DataChannel (private chat) or add tracks (voice/video)
const channel = pc.createDataChannel('chat'); // for private chat
// OR
localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); // for calls

// 4. Create + send SDP Offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
signalingChannel.send({ type: 'offer', sdp: offer });

// 5. Answerer receives offer, creates answer
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
signalingChannel.send({ type: 'answer', sdp: answer });
```

**ICE Servers used:**
- Google STUN servers (for NAT traversal)
- Open Relay TURN servers (fallback for strict firewalls — no cost)

---

### 5.7 Meeting Room Integration

Large meetings (30–50 participants) use the **Jitsi Meet External API**, which embeds a full Jitsi Meet session in an iframe.

**How it works:**
1. The user enters a meeting room name (e.g. `class-physics`).
2. The app dynamically loads the Jitsi External API script from `meet.jit.si`.
3. A `JitsiMeetExternalAPI` instance is created inside `#jitsi-container`.
4. The meeting room URL becomes: `https://meet.jit.si/{room-name}`
5. Features available: video grid, participant list, chat, screen sharing, mute controls.

**No Jitsi account is needed.** The public `meet.jit.si` server is free and open source. For a private deployment, you can self-host Jitsi and change `CONFIG.JITSI_DOMAIN` in `js/app.js`.

---

## 6. Deployment Guide

This guide takes you from zero to a live deployed platform in about 10–15 minutes.

---

### Step 1 — Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in (or create a free account).

2. Click the **+** icon → **New repository**.

3. Fill in the details:
   - **Repository name:** `alex-anonymous-platform` (or anything you like)
   - **Visibility:** Public or Private (both work with Vercel free tier)
   - Leave all other options as default

4. Click **Create repository**.

5. Upload your project files. You can either:

   **Option A — GitHub web interface (easiest):**
   - Click **uploading an existing file**
   - Drag and drop all files maintaining this structure:
     ```
     index.html
     css/main.css
     js/app.js
     README.md
     ```

   **Option B — Git command line:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Alex anonymous platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/alex-anonymous-platform.git
   git push -u origin main
   ```

---

### Step 2 — Configure Supabase

Supabase provides the real-time messaging infrastructure. The free tier is more than enough for small communities.

#### 2a. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New Project**.
3. Fill in:
   - **Organization:** Your personal org (or create one)
   - **Name:** `alex-platform` (or anything)
   - **Database Password:** Generate a strong password (save it somewhere, though you won't need it often)
   - **Region:** Choose the closest to your users
4. Click **Create new project**.
5. Wait ~2 minutes for the project to provision.

#### 2b. Enable Realtime

Realtime is enabled by default in new Supabase projects. To verify:

1. In your Supabase project, go to **Settings** → **API**.
2. You should see your **Project URL** and **anon public** key.

That's all you need! Alex uses Supabase Realtime Broadcast channels (no database tables required).

#### 2c. Get Your Credentials

From **Settings → API**, copy:
- **Project URL** — looks like `https://abcdefghijk.supabase.co`
- **anon (public) key** — a long JWT string starting with `eyJ...`

You'll paste these into the app config in the next step.

> ⚠️ **Never use the `service_role` key in the frontend.** Only use the `anon` key. The anon key is safe to expose publicly.

#### 2d. Configure Realtime Channels (No Table Needed)

Alex uses **Broadcast channels** for public chat and signaling — these are ephemeral (no data stored). You don't need to create any database tables.

However, if you want to enable the Supabase Realtime dashboard to inspect channel activity, go to **Realtime** in the sidebar — it should already be on.

---

### Step 3 — Update App Config

Open `js/app.js` in your code editor and find the `CONFIG` object near the top of the file (around line 41):

```javascript
const CONFIG = {
  SUPABASE_URL:      'https://YOUR_PROJECT_ID.supabase.co',  // ← Change this
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',               // ← Change this

  JITSI_DOMAIN: 'meet.jit.si',   // ← Leave this unless you self-host Jitsi

  ICE_SERVERS: [ ... ],          // ← Leave as-is (uses free STUN/TURN)
  // ...
};
```

Replace the placeholder values with your actual Supabase credentials:

```javascript
const CONFIG = {
  SUPABASE_URL:      'https://abcdefghijk.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  // ... rest stays the same
};
```

Save the file and commit/push to GitHub:

```bash
git add js/app.js
git commit -m "Configure Supabase credentials"
git push
```

---

### Step 4 — Deploy to Vercel

Vercel automatically builds and deploys your GitHub repository. It detects static HTML projects with zero configuration.

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.

2. Click **Add New** → **Project**.

3. Find and select your `alex-anonymous-platform` repository, then click **Import**.

4. Vercel will auto-detect it as a **Static Site**. You don't need to change any settings.

5. Click **Deploy**.

6. Wait ~30 seconds. Vercel will give you a live URL like:
   ```
   https://alex-anonymous-platform.vercel.app
   ```

7. **Done!** Share that URL with your community.

#### Auto-deploy on every push

Going forward, every time you push a change to GitHub, Vercel will automatically rebuild and redeploy. No manual steps needed.

#### Custom domain (optional)

In your Vercel project → **Settings** → **Domains**, you can add a custom domain (e.g. `alex.yourschool.com`) for free.

---

## 7. Local Development

No build tools or package manager required. Just serve the files with any static file server.

### Option A — Python (easiest, built into most systems)

```bash
# Navigate to your project folder
cd alex-anonymous-platform

# Python 3
python3 -m http.server 3000

# Python 2 (older systems)
python -m SimpleHTTPServer 3000
```

Open `http://localhost:3000` in your browser.

### Option B — Node.js (if installed)

```bash
# Install a simple static server globally (one-time)
npm install -g serve

# Serve the project
serve . -p 3000
```

### Option C — VS Code Live Server

If you use Visual Studio Code, install the **Live Server** extension. Right-click `index.html` → **Open with Live Server**.

### Option D — Any web server

Since Alex is a static site, any web server works: Nginx, Apache, Caddy, etc.

### Development notes

- WebRTC requires either `localhost` or a secure `https://` origin. Both work fine for development.
- The camera and microphone will request browser permissions the first time you join a call.
- Supabase credentials must be configured (Step 3) for chat and private messaging to work, even locally.

---

## 8. Supabase Setup (Detailed)

This section provides a deeper look at the Supabase configuration for administrators.

### What Alex uses Supabase for

| Feature | Supabase usage |
|---|---|
| Public Chat | Realtime Broadcast channel per room name |
| Chat presence | Realtime Presence (online count display) |
| Typing indicator | Broadcast event (ephemeral, no storage) |
| Private Chat signaling | Broadcast channel `p2p:{room_id}` |
| Voice/Video signaling | Broadcast channel `call:{room_name}` |

**Nothing is ever written to a database table.** All communication is ephemeral broadcast.

### Row Level Security (RLS)

Since no database tables are used, RLS configuration is not needed for Alex to function. Your Supabase database can remain completely empty.

### Realtime channel naming convention

| Channel name | Used for |
|---|---|
| `public-chat:{room-name}` | Public chat room (e.g. `public-chat:general`) |
| `p2p:{sha256-room-id}` | Private chat signaling between two peers |
| `call:{room-name}` | Voice/video call signaling |

### Supabase free tier limits

The Supabase free tier includes:
- **500 MB** database storage (unused by Alex)
- **2 GB** bandwidth per month
- **Realtime:** 200 concurrent connections
- **API:** 500,000 requests/month

For a classroom or small community (< 30 concurrent users), the free tier is more than sufficient.

### Scaling beyond free tier

If you need more than 200 concurrent connections (very large communities), consider:
1. Upgrading to Supabase Pro ($25/month — 500 concurrent connections)
2. Or self-hosting Supabase (open source, Docker-based)

---

## 9. Troubleshooting

### 🔴 "Configure your Supabase URL and Anon Key" warning appears

**Cause:** The `CONFIG` object in `js/app.js` still has the placeholder values.

**Fix:** Follow [Step 3](#step-3--update-app-config) — replace `YOUR_PROJECT_ID` and `YOUR_SUPABASE_ANON_KEY` with your actual credentials.

---

### 🔴 Chat shows "Connecting..." but never connects

**Possible causes:**
1. Wrong Supabase URL or Anon Key in `CONFIG`.
2. Supabase project is paused (free tier pauses after 1 week of inactivity).
3. Browser is blocking the Supabase CDN script (rare, check browser console).

**Fix for paused project:**
- Go to your Supabase dashboard → click on the project → click **Restore** if it's paused.
- Supabase free projects auto-pause after 1 week of inactivity. Just visiting the dashboard restores them.

---

### 🔴 Private chat "waiting for peer" indefinitely

**Cause:** WebRTC connection failed — usually a NAT/firewall issue between two users.

**What to try:**
1. Both users should try refreshing and reconnecting.
2. If one or both users are behind a corporate firewall or VPN, the TURN server fallback should handle it — wait up to 15 seconds.
3. Check the browser console (`F12`) for ICE connection errors.

---

### 🔴 Camera/microphone not working in calls

**Possible causes:**
1. Browser didn't grant camera/mic permissions.
2. Another app is using the camera exclusively.
3. The page is served over `http://` on a non-localhost domain (WebRTC requires HTTPS).

**Fix:**
- Click the camera icon in the browser address bar and allow permissions.
- Make sure you're accessing the site via the Vercel HTTPS URL, not over plain HTTP.

---

### 🔴 Video call shows "Waiting for others" even though someone joined

**Cause:** WebRTC signaling worked but the media connection failed (often a TURN server issue).

**Fix:**
- Refresh the page on both devices and rejoin the same room name.
- If the problem persists behind corporate firewalls, consider setting up your own TURN server (e.g. Coturn) and adding it to `CONFIG.ICE_SERVERS`.

---

### 🔴 Jitsi meeting room is blank or shows an error

**Cause:** The Jitsi External API script failed to load, or `meet.jit.si` is temporarily unavailable.

**Fix:**
1. Check if `https://meet.jit.si` is accessible from your network.
2. Try refreshing the page.
3. If your organisation blocks `meet.jit.si`, you can self-host Jitsi and update `CONFIG.JITSI_DOMAIN` to your own domain.

---

### 🔴 "Supabase CDN failed to load" in browser console

**Cause:** The CDN integrity hash in `index.html` may be stale if the Supabase JS library was updated.

**Fix:**
- Open `index.html`, find the `<script>` tag for Supabase.
- Remove the `integrity="..."` attribute entirely (this bypasses the SRI check).
- Save and redeploy.

---

### 🟡 Rocket avatars look the same for different users

**Cause:** This can happen if users choose very similar usernames or if the PRNG seed collides (rare with 256+ combinations).

**Note:** This is expected behavior — the rocket generator produces a finite set of combinations. Users can differentiate themselves via their Rocket ID code (e.g. `RKT-7A3`).

---

### 🟡 Identity was lost after clearing browser data

**Cause:** The token identity is stored in `localStorage`, which is cleared when browser data is wiped.

**Fix:** This is why the app shows 3 secret recovery phrases during identity creation. Users should save these phrases. They can restore their token identity using the **"Restore with secret phrases"** link on the username screen.

---

## 10. FAQ

**Q: Is there a database? Where is data stored?**

A: Public chat messages are never stored anywhere — they are broadcast in real-time and disappear as soon as all users leave the room. Private messages travel directly between browsers via WebRTC and never touch any server. Token identities are stored only in the user's browser (`localStorage`).

---

**Q: Can I see who else is in a chat room?**

A: You can see the online count (how many users are in the room). Identities are shown only by rocket avatar and call sign — no real names, emails, or IPs are exposed to other users.

---

**Q: Can someone track my IP address?**

A: In public chat, no IPs are exposed. In WebRTC calls and private chat, a direct P2P connection is established, which means the other peer technically sees your IP (this is inherent to WebRTC). If this is a concern, a VPN provides IP masking.

---

**Q: What happens if I close the tab during a call?**

A: The call ends for you immediately. Other participants will see your tile disconnect. They can continue their call among themselves.

---

**Q: How many people can use this at once?**

A: Public chat and signaling are limited by Supabase's concurrent connections (200 on the free tier). Calls and private chats are limited to 4 participants (WebRTC mesh limit). Meetings via Jitsi support up to 50+ participants.

---

**Q: Can I add a database to persist chat history?**

A: Yes. You would need to create a `messages` table in Supabase and insert messages via the Supabase JavaScript client. This is an intentional design choice not to persist messages — for privacy. If you add persistence, make sure to configure appropriate Row Level Security policies.

---

**Q: How do I change the Jitsi server to my own?**

A: In `js/app.js`, change `CONFIG.JITSI_DOMAIN` from `'meet.jit.si'` to your self-hosted Jitsi domain:
```javascript
JITSI_DOMAIN: 'jitsi.yourorganisation.com',
```

---

**Q: Can this run completely offline?**

A: The loading, username, identity reveal, and dashboard screens work without internet. However, real-time chat requires Supabase (internet), private chat and calls require both peers to be reachable (internet), and Jitsi requires internet. The core identity generation is 100% offline/client-side.

---

**Q: Does this work on mobile?**

A: Yes. The entire platform is responsive and tested on mobile browsers. Camera and microphone access on mobile requires the site to be served over HTTPS (which Vercel provides automatically).

---

## 11. Security & Privacy Notes

This section is for users and administrators who want to understand the privacy model.

### What is stored server-side

| Data | Stored? | Where |
|---|---|---|
| Usernames | No | Never |
| Chat messages | No | Broadcast-only, ephemeral |
| Communication tokens | No | localStorage only |
| Recovery phrases | No | Never |
| IP addresses | No | Not logged by Alex |
| Call media streams | No | P2P only |
| Private messages | No | DataChannel only |
| Room names | No | Not persisted |

### What is stored client-side (localStorage)

| Data | Purpose |
|---|---|
| `alex_identity` | Username, rocket config, token, phrases |

Clearing browser storage or private/incognito mode removes all identity data.

### Communication encryption

| Channel | Encryption |
|---|---|
| Public chat | TLS (Supabase WebSocket connection) |
| Private chat | DTLS + SRTP (WebRTC mandatory encryption) |
| Voice/video | DTLS + SRTP (WebRTC mandatory encryption) |
| Jitsi meetings | TLS + optional E2E encryption |

### What Supabase sees

Supabase acts as a relay/router for:
- Public chat messages (broadcast, not stored)
- WebRTC signaling messages (SDP offers/answers, ICE candidates — not stored)

Supabase does not see: private message content, call audio/video, or user tokens.

### Threat model

Alex is designed for **community trust** scenarios (classrooms, friend groups) — not for high-security adversarial environments. For maximum anonymity:
- Use Tor Browser (note: WebRTC may leak real IP even through Tor)
- Use a VPN
- Do not use personally identifying usernames

---

## Contributing

This project was designed as a deployable, self-contained platform. If you'd like to extend it:

- Add persistent chat history → Supabase `messages` table + `insert` calls
- Add end-to-end encryption for public chat → SubtleCrypto key exchange
- Add push notifications → Web Push API + Supabase Edge Functions
- Add custom emoji reactions → Broadcast additional event type

---

## License

MIT License — free to use, modify, and deploy for any purpose.

---

<div align="center">

**Built with ✦ for anonymous communities.**

*No registration. No tracking. Just rocket identities and encrypted channels.*

</div>
