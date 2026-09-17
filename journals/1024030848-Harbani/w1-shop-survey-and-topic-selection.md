# Week 1: Choosing SmartPrint and Surveying Thapar's Print Shops

Harbani Kaur
Roll No: 1024030848
25–31 August 2026

## 1 Context

Start of the project. Before writing any code, the two of us (Harbani and Ina) needed to
settle on a topic, confirm it was a real problem worth solving, and scope it before committing
to a build. This week was entirely research and planning — no repository existed yet.

## 2 Choosing the Topic

Went through a few candidate ideas before settling on a campus printing/photocopy management
system. The deciding factor: it was a problem both of us had personally run into on campus,
it had a clear set of users (students, faculty, shop staff, an admin), and it was scoped small
enough to build incrementally — a good fit for the course's phase-by-phase delivery model.
Landed on the name **SmartPrint**.

## 3 Field Survey: Visiting Print Shops Within Thapar

Rather than guessing at requirements, we walked to several of the photocopy/printing shops
around campus (the ones near the hostels and the ones closer to the academic blocks) and
watched the existing process end to end, from a student's side of the counter.

Observed workflow at every shop, with only minor variation:

- Student physically hands over a pen drive or walks in with a printed request.
- Shop staff opens the file, counts pages manually, and calculates the price on the spot —
  usually from memory or a handwritten rate card, not any system.
- Payment is cash-only, with no receipt tied to an order.
- No queue visibility: a student waiting for their print has no way to know how many jobs
  are ahead of theirs, and has to physically stand there to find out.
- No record survives past the transaction — if a print job is disputed (wrong price, wrong
  copies) there's nothing to check it against.

## 4 Loopholes and Pending Fixes Identified

From my side specifically (thinking about this from the student-facing/UI angle, since that's
where my share of the work would land), the recurring gaps were:

- **No remote queue visibility** — a student can't check order status without walking to the
  shop, which is the single biggest friction point during exam weeks.
- **Inconsistent, undocumented pricing** — price depends on which staff member is at the
  counter that day; nothing enforces a shop's own stated rate.
- **No differentiation surfaced to the student** upfront for colour vs. B/W, paper size, or
  finishing (binding/stapling) before they commit to printing.
- **No account/history** — a student can't look back at what they printed or what they paid.

These map directly onto the feature list we scoped afterwards: per-shop pricing, an explicit
print-settings step before payment, and an order-tracking view for the student.

## 5 Talking to a Senior

We also reached out to a senior who had built something in a similar space before and was
willing to informally guide us. Their main advice, which shaped the scope for the rest of the
project:

- Keep the first version's queue **strictly FIFO** — no priority scheduling — since that's
  already a big improvement over "no visibility at all," and dynamic scheduling is a rabbit
  hole for a project this size.
- Don't wire up a real payment gateway on day one; build the payment step behind an
  abstraction so a mock provider can stand in during development and a real one can be
  swapped in later without touching the rest of the order flow.
- Separate roles early (student, faculty, shop staff, admin) rather than bolting on
  permissions after the fact.

## 6 Outcome

By the end of the week we had: a confirmed topic (SmartPrint), a rough workflow (upload →
choose shop & settings → pay → track → collect), a role list (Student, Faculty, Shop Staff,
Admin), and an informal split of ownership going into Week 2 — I'd focus on the frontend,
Ina on the database and backend.

## 7 Follow-ups

- Turn the rough workflow into an actual ER diagram before writing any schema.
- Decide on the concrete tech stack for frontend and backend.
- Decide how auth should work (who can sign up, how staff/admin accounts get created).
