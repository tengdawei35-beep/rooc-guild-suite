# HMDL / Heimdall Official Discord Server Template

## Purpose

The official HMDL Discord is the SaaS community, support and product hub. It is **not** a template for customer guild Discord servers.

## Server name

**⚔️ HMDL — Heimdall**

Brand line: **Guild management, simplified.**

Official invite: https://discord.gg/48yTtF9UxP

---

## Category and channel structure

### ⚔️ HEIMDALL

| Channel | Type | Purpose | Public posting |
|---|---|---|---|
| `#welcome` | Text | First-stop introduction and navigation | HMDL only |
| `#announcements` | Announcement | Major releases, service announcements and maintenance | HMDL only |
| `#changelog` | Text | Detailed product release history | HMDL only |
| `#roadmap` | Text | Now / Next / Later product roadmap | HMDL only |

### 💬 COMMUNITY

| Channel | Type | Purpose | Public posting |
|---|---|---|---|
| `#general` | Text | General HMDL community discussion | Everyone |
| `#guild-management` | Text | Guild leadership and management discussion | Everyone |
| `#feature-requests` | Forum | Feature requests and voting | Everyone |
| `#showcase` | Forum | Guild setups, achievements and HMDL workflows | Everyone |
| `#off-topic` | Text | General conversation | Everyone |

### 📚 LEARN HMDL

| Channel | Type | Purpose | Public posting |
|---|---|---|---|
| `#getting-started` | Text | Step-by-step HMDL onboarding | HMDL only |
| `#guides` | Forum | Product guides and workflows | HMDL only |
| `#faq` | Text | Frequently asked questions | HMDL only |
| `#tips-and-tricks` | Text | Practical guild-management tips | Everyone |

### 🆘 SUPPORT

| Channel | Type | Purpose | Public posting |
|---|---|---|---|
| `#help` | Forum | User support requests | Everyone |
| `#bug-reports` | Forum | Reproducible product bugs | Everyone |
| `#account-billing` | Text / Tickets | Account and subscription support | Everyone |
| `#known-issues` | Text | Current incidents and known problems | HMDL only |

### 🔔 HMDL NOTIFICATIONS

| Channel | Type | Purpose |
|---|---|---|
| `#product-updates` | Text | Automated product/bot updates where appropriate |
| `#service-alerts` | Text | Important service incidents and maintenance |

### 🔒 HEIMDALL TEAM

Private category.

- `#staff` — general staff coordination
- `#development` — engineering and release coordination
- `#support-team` — customer support coordination
- `#moderation` — moderation and incident handling

### 🔊 VOICE

- `Community Lounge`
- `Support Room`
- `Heimdall Team`

---

## Roles

### Staff hierarchy

1. 👑 **Founder**
2. 🛠️ **Developer**
3. 🛡️ **Administrator**
4. 🎧 **Support**
5. 🔨 **Moderator**

### Community roles

- ⭐ **Beta Tester**
- 🧪 **Early Access**
- 🤝 **Partner**
- 👤 **Member**

### Optional subscription roles

Add these only when Discord/billing synchronization is ready:

- 💠 **HMDL Basic**
- ⚔️ **HMDL Total**

Subscription roles should primarily be used for identity, beta access and optional subscriber perks rather than hiding the main community behind a paywall.

---

## Permission model

| Role | Community | Support | Announcements | Staff |
|---|---|---|---|---|
| Member | Read/write | Create posts/tickets | Read | No |
| Beta Tester | Read/write | Create posts/tickets | Read | No |
| Support | Read/write | Manage | Post where needed | Support |
| Moderator | Moderate | Manage | Read | Moderation |
| Developer | Read/write | Manage | Post | Development |
| Administrator | Full | Full | Full | Full |
| Founder | Full | Full | Full | Full |

The HMDL bot should have its own role and only the permissions required for its functions. Avoid giving the bot Administrator unless a future feature genuinely requires it.

---

## Welcome message

> ## Welcome to Heimdall ⚔️
>
> Heimdall is a guild management platform built for guilds that want to spend less time managing spreadsheets, Discord messages and manual processes — and more time playing.
>
> **With HMDL you can:**
> • Manage your guild roster
> • Organize events and raids
> • Manage bids and allocations
> • Track member statistics
> • Manage resources and reservations
> • Connect your guild with Discord
>
> **Getting started**
> → Read `#getting-started`
> → Explore the community
> → Start HMDL at the official website
>
> Welcome to Heimdall.

---

## Getting started message

```text
1️⃣ Create your HMDL account
        ↓
2️⃣ Create or join your guild
        ↓
3️⃣ Import your members
        ↓
4️⃣ Connect Discord
        ↓
5️⃣ Create your first event
        ↓
6️⃣ Build your first roster
```

---

## Community rules

1. Be respectful.
2. No harassment or personal attacks.
3. No spam or unsolicited advertising.
4. Keep discussions reasonably relevant to the channel.
5. Never share private account, payment or authentication information.
6. Report bugs through `#bug-reports` rather than burying them in general chat.
7. Do not impersonate HMDL staff.
8. Follow Discord's Terms of Service.

The HMDL team may moderate content that negatively impacts the community.

---

## Feature request forum template

```text
Title: [FEATURE] Short description

## Problem
What problem would this solve?

## Proposed solution
What would you like HMDL to do?

## Why it matters
Who would benefit and how?

## Examples
Optional screenshots, examples or competing products.
```

## Bug report forum template

```text
## Problem
What happened?

## Expected
What should have happened?

## Steps to reproduce
1.
2.
3.

## Screenshots
Attach screenshots where useful.

## Browser
Chrome / Edge / Firefox / etc.

## HMDL page
Paste the page URL if applicable.
```

---

## Announcement / changelog style

Use a consistent format:

```text
⚔️ HMDL 1.4.0

### New
• Discord roster notifications
• Completed bid notifications
• Weekly stat reminders

### Improved
• Roster management
• Applicant stat viewing

### Fixed
• Bid-page navigation
• Roster synchronization

Released: DD MMM YYYY
```

Keep `#announcements` short and high-signal. Put technical detail in `#changelog`.

---

## Roadmap format

```text
NOW
━━━━━━━━━━━━━━━━
🔨 Current active work
🔨 Current active work

NEXT
━━━━━━━━━━━━━━━━
📋 Planned feature
📋 Planned feature

LATER
━━━━━━━━━━━━━━━━
💡 Longer-term idea
💡 Longer-term idea
```

Avoid promising exact dates unless the team is confident they can be met.

---

## Discord onboarding

Enable Discord Community Onboarding with:

### What brings you to HMDL?

- I'm managing a guild
- I'm an officer
- I'm a guild member
- I'm evaluating HMDL
- I'm here to learn

### What do you want to learn about?

- Rosters
- Events / Raids
- Bidding
- Resources
- Guild management
- Discord integration

Use responses to expose relevant community channels without overwhelming new members with every channel at once.

---

## HMDL bot notification strategy

The official HMDL Discord and customer guild Discords serve different purposes.

**Official HMDL Discord:**
- Product announcements
- Changelog
- Service alerts
- Community updates
- Support

**Customer guild Discord:**
- Roster saved/updated notifications
- Completed bid notifications, including users involved in the bid
- Weekly stat reminders
- Event-specific operational notifications

Do not mix customer guild operational notifications into the official HMDL community channels.

---

## Recommended future automation

When HMDL billing and Discord identity are fully connected, subscription roles can be synchronized automatically:

```text
Stripe subscription
        ↓
HMDL billing state
        ↓
Discord role sync
        ↓
HMDL Basic / HMDL Total
```

Beta and Early Access roles can remain manually controlled by the HMDL team.
