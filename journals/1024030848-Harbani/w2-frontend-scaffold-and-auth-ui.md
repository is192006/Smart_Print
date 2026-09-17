# Week 2: ER Diagram, Frontend Scaffold, and a Dead Repo

Harbani Kaur
Roll No: 1024030848
1–6 September 2026

## 1 Context

With the topic and rough scope settled from Week 1, this week was about turning that into
something real: a finalized data model, and the first working piece of the frontend built
against it. This is also the week our original GitHub fork died and had to be abandoned —
more on that below.

## 2 Finalizing the ER Diagram

Sat together in the hostel mess late into the night over a couple of sessions to actually
draw out the ER diagram — students, faculty, shop staff, and admin as user roles; shops;
documents; orders; a queue; payments; refunds; and per-shop pricing/finishing rules. We went
through several versions of this before settling on one: the first couple of attempts tried
to cram pricing directly onto the order, which fell apart as soon as we asked "what happens
when a shop changes its rate after an order already exists" — the order needs to freeze the
price it was quoted, not recompute it later. The version we finalized separates a shop's
current pricing/finishing rules from what actually got charged on a given order.

## 3 Frontend Scaffold

My share of the work for this phase was the frontend. Scaffolded the client as a React 19 +
TypeScript app on Vite, with React Router for navigation, under `code/frontend/`. Set up the
pieces that everything else would build on top of, rather than any specific feature page yet:

- Routing shell and protected-route guards, so pages can be gated by whether a user is
  logged in (and later, by role) before any real pages existed behind them.
- An `AuthContext` to hold the logged-in user and expose login/logout, matching the shape of
  the auth API Ina was building on the backend in parallel.
- A small shared UI kit (buttons, cards, inputs, modal, badges, spinner) so later pages
  wouldn't each invent their own styling.
- Basic login/register pages wired to call the backend's auth endpoints once they existed.

## 4 Debugging: The Fork That Wouldn't Push

**Error encountered:** partway through the week, my GitHub fork of the course template
started rejecting every `git push` with a file-size error — GitHub refuses any single file
over 100 MB, and one had ended up in my commit history before I'd set up a proper
`.gitignore` for the frontend (a dependency folder that should never have been committed in
the first place).

**Relevant context:** removing the offending file in a *later* commit doesn't fix this — the
oversized blob is still sitting in an earlier commit's history, and GitHub checks the whole
history being pushed, not just the current state of the files.

**Key observation:** the real fix is rewriting history to strip the blob out entirely (e.g.
`git filter-repo` or an interactive rebase dropping the bad commit), which is fiddly to get
right and easy to make worse under deadline pressure, especially stacked on top of my laptop
already being unreliable that week.

**Solution:** rather than fight the corrupted fork, we cut our losses — Ina cloned the
official course template fresh on her machine, and we pushed everything both of us had built
up to that point (ER diagram artifacts, my frontend scaffold, her schema and backend) from
there as one combined commit. This is also why the GitHub history shows a single large
initial commit authored by Ina rather than incremental commits from both of us — it's not
that the work wasn't shared, it's that the working copy that survived was hers.

**Because** a `.gitignore` has to be in place *before* the first commit that touches a
generated folder — once something large is committed, keeping it out going forward isn't
enough; it has to be surgically removed from history, which is a much bigger job than not
committing it in the first place.

## 5 Outcome

By the end of the week: a finalized ER diagram, a running frontend scaffold with routing,
auth context, and a shared UI kit in place, and the combined Week 1–2 work pushed to GitHub
from Ina's clean clone.

## 6 Follow-ups

- Set up a proper `.gitignore` from day one on any future clone/fork, before the first
  commit.
- Build out the actual student-facing pages (upload, print settings, order tracking) on top
  of the scaffold — not yet started.
- Staff/admin dashboards are still just placeholders in the routing, no real pages behind
  them yet.
