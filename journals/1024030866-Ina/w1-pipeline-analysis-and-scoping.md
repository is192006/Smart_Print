# Week 1: Choosing SmartPrint and Auditing the Print Shop Pipeline

Ina Sharma
Roll No: 1024030866
25–31 August 2026

## 1 Context

Start of the project. Before writing any code, the two of us (Ina and Harbani) needed to
settle on a topic, confirm it was worth building, and scope it before committing to an
implementation. This week was entirely research and planning — no repository existed yet.

## 2 Choosing the Topic

Went through a few candidate ideas before settling on a campus printing/photocopy management
system, **SmartPrint**. It was a problem we'd both personally run into on campus, had a clear
set of user roles, and was small enough to scope into incremental phases rather than one big
build.

## 3 Field Survey: Visiting Print Shops Within Thapar

Visited several of the photocopy/printing shops around campus to understand the existing
process as it actually runs today, not how we assumed it worked.

Observed at every shop:

- Everything is manual and in-person: hand over the file, staff counts pages and prices it
  on the spot, pay cash, wait.
- No digital record of any order — nothing to reconcile against if a price or page count is
  disputed.
- One job prints at a time per shop, but there's no structure behind that beyond "whoever's
  next in the physical line."
- Faculty and students are treated identically at the counter even though, at the CSE
  department shop specifically, faculty printing is meant to be free — currently enforced
  only informally, by staff recognizing faces.

## 4 Loopholes and Pending Fixes Identified

Looking at this from the system/pipeline side (since my share of the work would land on the
data model and backend), the gaps that stood out as things a backend actually needs to solve:

- **No source of truth for price** — pricing needs to live in one place per shop (per page,
  per colour mode, per finishing option) and be computed server-side at order time, never
  trusted from whatever the client sends.
- **No queue state machine** — an order has no formal lifecycle today; it's just "in
  progress" until it's done. We'd need explicit states (placed → paid → queued → printing →
  ready → collected) so both the student and the shop can query where an order actually is.
- **No faculty exemption logic** — the free-printing-for-faculty case needs to be encoded as
  a rule, not left to staff memory.
- **No cancellation/refund path** — right now a mistaken order just gets sorted out verbally
  at the counter; a digital system needs an explicit cancel-before-printing and
  refund-after-payment path.

## 5 Talking to a Senior

Along with Harbani, we spoke to a senior who'd built something similar before and offered to
guide us informally. From a backend-scoping angle, the advice that stuck:

- Don't build a real payment integration first — put a payment abstraction in front of a mock
  provider so the order flow can be built and tested without depending on a live gateway.
- Keep the queue strictly FIFO for now; ordering by "time confirmed for printing" is enough
  for a first version and avoids designing a priority system nobody's asked for yet.
- Model roles (student, faculty, shop staff, admin) as a first-class part of the schema from
  the start, since permissions bolted on later tend to leak.

## 6 Outcome

By the end of the week: a confirmed topic, a rough end-to-end workflow, a role list, and a
working split for Week 2 — Harbani on the frontend, me on the database schema and backend.

## 7 Follow-ups

- Turn today's notes into an actual ER diagram before touching Prisma.
- Decide on the concrete tech stack (which ORM, which auth strategy).
- Figure out how shop staff/admin accounts get created, since (unlike students) they
  shouldn't be able to just self-register.
