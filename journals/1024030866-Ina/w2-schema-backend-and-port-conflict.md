# Week 2: Database Schema, Backend Setup, and a Port Collision

Ina Sharma
Roll No: 1024030866
1–6 September 2026

## 1 Context

With the rough scope settled from Week 1, this week was about turning it into a real data
model and a working backend: schema, auth, and the base Express setup. This is also the week
Harbani's GitHub fork died, which is why the history for this phase ended up pushed from my
machine — see her Week 2 entry for the fork/push side of that story.

## 2 Finalizing the ER Diagram

Worked through this together with Harbani over a couple of late sessions in the hostel mess.
Went through multiple versions before settling on one — the earlier attempts kept pricing
directly on the order record, which broke as soon as we considered a shop changing its rates
after orders already existed. Landed on keeping a shop's pricing/finishing rules separate
from the price actually charged on a given order, plus explicit models for users (with a
role), shops, documents, orders, a per-shop queue, payments, and refunds.

## 3 Database Schema

Turned the finalized diagram into an actual Prisma schema against PostgreSQL. First attempt
at the migration turned out to have modeling issues once I tried seeding data against it
(role-specific fields that should only apply to shop staff weren't actually constrained to
shop staff), so I dropped it and generated a second, corrected initial migration the next
day rather than patching the first one — cleaner than trying to migrate a migration this
early, with no real data to lose yet.

## 4 API Auth and User Model

Implemented the user model with a single `role` field (student / faculty / shop staff /
admin) rather than separate tables per role, since almost everything about a user is shared
and only a handful of fields (like which shop a staff member belongs to) are role-specific.
Auth is JWT-based with bcrypt-hashed passwords, and self-registration is restricted to the
college email domain so random accounts can't sign up as students — staff and admin accounts
are meant to be provisioned by an admin instead, not self-registered.

## 5 Backend Setup

Scaffolded the Express + TypeScript backend under `code/backend/` with a layered structure —
routes calling controllers calling services — plus environment config and a health-check
route to confirm the server itself was up before wiring anything real behind it.

## 6 Debugging: The Port That Was Already Taken

**Error encountered:** the backend appeared to start fine, but every request from the
frontend to the API was failing to connect, with no obvious error on the frontend side.

**Relevant context:** I'd set the backend to run on a port that, it turned out, another
project on my laptop was already using in the background from earlier that day. Node
actually did print an `EADDRINUSE: address already in use` error in the terminal when the
backend tried to start — I just didn't notice it, because I'd scrolled past it assuming the
usual noise from `npm run dev`, and went straight to suspecting the database connection
instead.

**Key observation:** Harbani and I spent a good chunk of time double-checking `DATABASE_URL` and
re-running migrations for nothing, before scrolling back up in the terminal and actually
reading the startup output line by line — at which point the `EADDRINUSE` was sitting right
there.

**Solution:** killed the leftover process from the other project and restarted the backend
cleanly; also picked a less commonly-defaulted port for this project's `.env.example` so a
future collision is less likely, and left a comment there explaining why.

**Because** a silent failure to bind a port doesn't fail loudly on the *client* side — the
frontend just sees a connection it can't complete, with nothing pointing back at "someone
else is squatting on the port you asked for" unless you actually read the server's own
terminal output.

## 7 Outcome

By the end of the week: a finalized ER diagram, a working Prisma schema and migration
history, JWT-based auth restricted to the college domain, a scaffolded Express backend, and
the full Week 1–2 work (mine and Harbani's) pushed to GitHub from a fresh clone of the course
template, after her original fork became unusable.

## 8 Follow-ups

- No shop, order, or queue endpoints built yet — only auth and the base server exist so far.
- Pricing rules, the print queue's actual FIFO logic, and payments/refunds are all still
  ahead of us; nothing in that area is implemented yet.
- Should double check the `.env.example` port choice doesn't just move the same collision to
  a different commonly-used number.
