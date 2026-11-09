# PRD: Phase 1 MVP – Virtual Hospital Chain for Tier-2/3 India

Oct 9, 2026 · @Raunak

## 1. Executive summary

We will build a branded "virtual hospital chain" of verified solo doctors in one Tier-2/3 city. It runs on WhatsApp, with honest reviews and live doctor status, and the goal is to pass ₹50k/month revenue by month 4 while risking no more than about ₹30k of a ₹2–3 lakh cap.

- **Who it serves:** doctors 2–10 years after licensing who need patient flow, and patients who waste trips to clinics where the doctor is absent or the queue is unknown.
- **What Phase 1 ships:** verified profiles, structured verified-visit reviews, WhatsApp/phone-first slot booking, live doctor status, live queue position, and delay/cancellation alerts.
- **What it does not ship:** health records, EMR, telehealth, pharmacy, insurance, AI.
- **How it grows:** 15–30 doctors onboarded first, reviews seeded from their existing patients, then patient discovery opens. Growth comes from doctor-to-doctor referral and pharmacy/lab partners, not field sales at scale.
- **How it makes money:** a ₹10–15 patient booking fee, a ₹300–500/month doctor subscription once value is proven, and ₹5–10k/month from 2–3 pharmacy/lab partners.
- **How it is built:** months 1–3 run manually on WhatsApp and a spreadsheet at ₹0 build cost. The founder builds the app (React Native/Next.js + NestJS) only after the core assumptions hold.

## 2. Problem statement

Primary care in Tier-2/3 India runs through small clinics and solo doctors with no online presence, and both sides lose because of it.

**Patients**

- Find doctors only by word of mouth, with no reliable signal of quality.
- Book by phone or walk-in, so they often travel to find the doctor absent, late or on leave.
- Wait in long, unpredictable queues with no idea of their position.

**New doctors**

- Without an institutional name, building a patient base is slow. It takes 5–10 years to open an independent clinic, then 2–5 more to ramp to ₹1–2L/month, or about 12–17 years from starting MBBS.
- They have no affordable way to signal quality or fill empty slots.
- Existing platforms make them pay for visibility in ways patients cannot see (see section 4).

We will not touch the clinic's clinical work in Phase 1. We fix discovery, trust, booking and waiting.

## 3. Target users and market

The paying side is underserved doctors who need patients, not established doctors. Patients are the demand we bring them.

| Segment | Who | What they need from us | Role in Phase 1 |
| --- | --- | --- | --- |
| Core doctors | GPs and common specialists 2–10 years after licensing, solo or small clinic, in the pilot city | Steady patient flow, visible proof of quality, fewer no-shows | Main target; 15–30 in pilot |
| Anchor doctors | 2–5 respected local doctors | Guaranteed-slot booking and less phone chaos, at no cost | Credibility for the brand; free listing |
| Patients | Adults booking for themselves or family; smartphone + WhatsApp, often not app installers | Know the doctor is in, know the wait, book without a call | Demand side; pays booking fee |
| Partners | 2–3 local pharmacies and diagnostic labs | Referral traffic from network doctors' patients | Secondary revenue from about month 4 |

**Pilot city criteria (city still to be chosen):** Tier-2/3 with few hospitals, high WhatsApp use, a founder or team member with local ties, and enough clinics to reach 60 doctors within about 6 months.

## 4. Competitive landscape

Practo owns discovery and booking, but nobody owns verified trust for solo doctors in Tier-2/3 cities. That gap is our opening. The points below come from our earlier discussion and have not been re-checked against sources (approximate).

| Player | What they do | Weakness we exploit |
| --- | --- | --- |
| Practo | Discovery and booking, Ray EMR, telehealth; about $700M valuation, IPO expected around 2027 | Costly field-sales doctor acquisition; opaque, upsell-heavy pricing; credible complaints that paying doctors rank and review better; thin proven Tier-2/3 depth; attention on AI, UAE and IPO |
| Lybrate | Discovery and Q&A | Weakened; low momentum |
| Bharosa | Pivoted to AI voice receptionist; pre-revenue | No longer a trust/discovery network |
| Status quo | Word of mouth, phone, walk-in | No quality signal, no wait information |

**Our defensible edges:** a brand quality bar, reviews that cannot be bought, live status that works on WhatsApp, and dense coverage of one city before the next.

## 5. Product positioning

**Positioning statement:** for patients in [pilot city] who need a doctor they can trust and reach on time, [Brand] is a network of verified local doctors, a virtual hospital chain. It shows who is in, how long the wait is, and what real patients said. Unlike Practo, no doctor can pay to rank higher or hide reviews.

- **Branded network, not a directory.** Patients trust the brand's standard, the way OYO and Urban Company built trust without famous providers.
- **Quality bar to join:** a valid medical council registration, a physical clinic check by a field rep, agreement to keep status updated and honour bookings, and a minimum review standard after 3 months.
- **Promise to doctors:** more patients and fair reviews, with no pay-to-rank.
- **Promise to patients:** no wasted trip and honest reviews.

The brand name and visual identity are still to be decided (section 12).

## 6. Phase 1 MVP scope

Phase 1 has six features, and every one must work over WhatsApp and phone first. Months 1–3 deliver them by hand (shared WhatsApp Business number, Google Sheet, ops person). The app is built only for the parts that prove painful to run manually.

| # | Feature | Manual version (months 1–3) | Built version (from about month 4) |
| --- | --- | --- | --- |
| F1 | Verified doctor profiles | Sheet row + WhatsApp catalogue card + QR poster in clinic | Public profile web page per doctor, admin verification queue |
| F2 | Structured reviews | Ops sends a review form link after a confirmed visit | Review form tied to booking ID, moderation tools |
| F3 | Slot booking | Patient messages or calls; ops books in the doctor's sheet tab and confirms | WhatsApp bot + web booking against live slot inventory |
| F4 | Live doctor status | Doctor or receptionist sends a 1-tap message (IN / LATE 20 / LEAVE) to ops | Doctor app toggle; status shown on profile |
| F5 | Live queue + wait estimate | Receptionist updates current token number in a shared sheet | Token tracker; patient gets "you are #4, about 25 min" |
| F6 | Delay/cancellation alerts | Ops broadcasts to that day's booked patients | Automatic WhatsApp template messages |

### 6.1 Doctor onboarding flow

1. Field rep pitches; doctor agrees and shares their medical council registration number, degree, specialty, clinic address, timings, fee and photo.
2. Ops verifies registration on the NMC/state medical council register and records proof (screenshot, date, verifier).
3. Field rep visits the clinic, confirms it exists and matches the details, and installs the QR poster and counter card.
4. Doctor or receptionist is trained in 10 minutes on status and token updates and slot rules.
5. Doctor shares the review link with 10–20 recent patients to seed reviews (section 8).
6. Profile goes live once verified and it has at least 3 reviews.

**Done when:** a verified doctor is live within 7 days of saying yes, and every live profile has a stored verification record.

### 6.2 Patient booking flow

1. Patient scans the clinic QR, clicks a profile link, or messages the WhatsApp number.
2. Patient sees today's status (in, late, on leave), current queue and the next free slots.
3. Patient picks a slot and gives name, phone and reason (one line, optional).
4. Patient pays the ₹10–15 convenience fee by UPI link, only for doctors where the fee applies (section 9).
5. Confirmation message arrives with slot, token number, clinic location pin and the rule: arrive 10 minutes early, and the slot is released after 15 minutes late.
6. Reminder goes out 2 hours before; on the day, the patient can reply STATUS for queue position.
7. After the visit, the doctor or reception marks it attended, which unlocks the review link.

**Phone fallback:** ops takes calls during clinic hours and books the same way.
**No-show policy:** two no-shows block online booking for 30 days.

**Done when:** booking takes 3 messages or fewer for a returning patient, and the confirmed booking matches the clinic's own slot list.

### 6.3 Live status and queue

- **Doctor status:** In clinic; Running late (ETA in minutes); On leave / closed today; Not yet in (default before session start). Status untouched 30 minutes past session start triggers an ops call to the clinic.
- **Queue:** current token, patients ahead, estimated wait = patients ahead × doctor's average consult time (start at 10 minutes, then learn from timestamps).
- **Alerts:** any change to late (more than 15 minutes), leave or cancellation messages every patient booked for that session within 5 minutes and offers the next slot.
- **Honesty rule:** show "last updated X min ago" on every status. Stale data hurts trust more than no data.

**Done when:** at least 80% of sessions have a status update before start, and wait estimates are within ±15 minutes for 70% of visits.

### 6.4 Structured reviews (anti pay-to-win)

| Rule | Detail |
| --- | --- |
| Verified visit only | Review link issued only for an attended booking or a doctor-seeded past patient (marked "existing patient" on the review) |
| Cool-down | Link opens 2 hours after the visit and expires after 14 days |
| One per visit | One review per booking ID; edits allowed within 7 days |
| Dimensions | Rated 1–5 on: explained clearly, wait vs promised, cleanliness, behaviour of staff, value for fee; plus would-recommend yes/no and free text |
| Right of reply | Doctor can post one public reply per review |
| Fraud checks | Same phone across many doctors, bursts of reviews in a day, reviews from the doctor's own number, copy-paste text; flagged reviews held for ops |
| Transparent appeals | Doctor can appeal a review once with a reason; ops decides within 7 days; outcome logged and visible as "reviewed by [Brand]" |
| No paid influence | Subscription or fees never change ranking, review visibility or order. Ranking = distance, availability, rating; the rule is published on the site |

**Done when:** every review traces to a booking or seeded patient, and no doctor can remove a review except through a logged appeal.

### 6.5 Out of scope for Phase 1

- QR-linked patient health record and lost-prescription retrieval (Phase 2, pending legal review)
- EMR or clinical notes
- Telehealth or video consults
- Pharmacy ordering or delivery
- Insurance
- AI features (chatbots beyond simple WhatsApp menus, triage, recommendations)
- Online consultation fee collection on behalf of the doctor (the patient pays the doctor at the clinic)

**Data rule for Phase 1:** collect only name, phone, booking time and a one-line reason. No diagnoses, prescriptions or reports are stored, which keeps Phase 1 clear of health-record obligations.

## 7. Future phases

Nothing past Phase 1 starts until the pilot city hits its month-6 targets (section 11). Phase 2 also needs a written legal opinion first.

| Phase | What | Gate to start |
| --- | --- | --- |
| Phase 2 | QR-linked patient health record: patient-held QR to retrieve past prescriptions and visit notes; lost-prescription recovery | Lawyer sign-off on consent and access design under the DPDP Act 2023 and ABDM (per-visit OTP vs session consent, data retention, doctor access scope, breach process) |
| Phase 2 | Doctor subscription (₹300–500/month) with a dashboard: bookings, no-shows, rating trends | 60%+ of core doctors say the platform brought new patients |
| Phase 2 | Pharmacy/lab partner referrals in-flow | 2–3 signed partners in the pilot city |
| Phase 3 | Second city, using the pilot playbook | Pilot contribution-positive for 3 straight months |
| Later | EMR, telehealth, pharmacy delivery, insurance, AI | Deferred; revisit only with funding or clear doctor demand |

## 8. Go-to-market plan

One city, doctors first, patients second. The platform never opens to patients while empty.

- **Stage A, months 1–2: seed supply.** Sign 2–5 anchor doctors free, then 15–30 core doctors. Each doctor sends the review link to 10–20 existing patients, so every profile launches with real reviews.
- **Stage B, from month 2–3: open discovery.** Push the WhatsApp number and profile links through clinic QR posters, counter cards, local WhatsApp and Facebook groups, and Google Business Profile listings that link to the booking page.
- **Stage C, months 3–6: compound.** Turn on doctor-to-doctor referral (a doctor who brings a colleague gets 2 months free when subscriptions start). Sign 2–3 pharmacy/lab partners who display the QR and get referral traffic.

### Team and roles

| Role | Count | Main job | Target | Pay |
| --- | --- | --- | --- | --- |
| Founder | 1 | Product, tech, pricing, partner deals, first anchor doctors | Builds app from month 4 | ₹0 |
| Care / ops support | 1 | Bookings, status relay, alerts, review moderation, sheet upkeep | Reply to patients within 5 min in clinic hours | ₹7–8k/month |
| Field rep | 2 | Doctor pitching, verification visits, QR setup, retraining | 5 doctors/month each (10 total) | ₹7–8k/month each |

Hiring order: ops person plus one rep in month 1, second rep by month 2–3 once the pitch converts. Field reps pitch the same three proofs every time: patients booked last week, no-show reminders, and honest reviews.

## 9. Monetization and revenue model

Patients pay a small booking fee from day one. Doctors pay nothing until the platform has visibly brought them patients.

| Stream | Who pays | Price | When it starts |
| --- | --- | --- | --- |
| Booking convenience fee | Patient, per confirmed booking | ₹10–20 (model uses ₹10–15) | Month 1, by UPI link |
| Doctor subscription | Core doctors | ₹300–500/month | Only after the doctor sees proven value (about month 4–6) |
| Partner referral fee | 2–3 pharmacies/labs | ₹5–10k/month flat each | About month 4 |
| Anchor doctors | Nobody | Free listing | Always |

One option discussed was charging the fee only for anchor doctors' guaranteed slots. The ramp below assumes it applies to every booking. If it is limited to anchors, booking revenue falls sharply and the subscription has to carry the model; test this in month 1 (section 12).

The conservative ramp (doctors join mid-month, ₹10 per booking) is in the cash table in section 10. Partner fees add ₹10–30k/month from about month 4 and are not in the chart. Subscriptions at ₹400 from 40 doctors would add about ₹16k/month.

## 10. Budget and cost plan

Phase 1 burns about ₹28–34k a month, turns cash-positive in month 3, and puts at most about ₹30k of the ₹2–3 lakh cap at risk if volume assumptions hold.

### Monthly cost lines

| Item | Cost | Notes |
| --- | --- | --- |
| Team | ₹15k in month 1, ₹22.5k from month 2 | Ops person + 1 rep in month 1; second rep by month 2–3 |
| Infra | ₹2.5k rising to about ₹10k | Hosting, WhatsApp Business API (Interakt/Gupshup), SMS/OTP, domain; scales with doctors and messages |
| Payment gateway | About 2% + GST per transaction | Deducted from fee revenue; on a ₹10 fee, check the minimum charge per transaction |
| Marketing kit | ₹150–250 per doctor (lean) | QR card + poster, printed in bulk; about ₹9–15k over 6 months. Full kit at ₹1–2k/doctor is not needed |
| One-time setup | About ₹8k in month 1 | Domain, WhatsApp API setup, first bulk print run |
| Development | ₹0 | Founder builds; optional no-code tools ₹0–25k only if manual ops break first |

### Cash plan, months 1–6 (conservative case)

Revenue assumes ₹10 per booking, 5 bookings/day, 26 days, and doctors who join mid-month earning half a month.

| Month | Live doctors | Revenue | Costs | Net | Cumulative |
| --- | --- | --- | --- | --- | --- |
| M1 | 10 | ₹6.5k | ₹28k (incl. setup) | −₹21.5k | −₹21.5k |
| M2 | 20 | ₹19.5k | ₹28.5k | −₹9k | −₹30.5k |
| M3 | 30 | ₹32.5k | ₹30k | +₹2.5k | −₹28k |
| M4 | 40 | ₹45.5k | ₹31k | +₹14.5k | −₹13.5k |
| M5 | 50 | ₹58.5k | ₹32.5k | +₹26k | +₹12.5k |
| M6 | 60 | ₹71.5k | ₹34k | +₹37.5k | +₹50k |

**Downside check:** at 40% of this volume (about 2 bookings/day per doctor), the plan loses money every month and cumulative losses reach about ₹90k by month 6. That is still inside the cap, but it is the signal to change pricing or the model (section 12).

**Spending rules:** no hire beyond the next month's need, no custom build before month 3, and no paid ads in Phase 1.

## 11. Success metrics

The one number that matters is paid bookings per doctor per day. The rest explain why it moves.

| Metric | Month 3 target | Month 6 target | Why it matters |
| --- | --- | --- | --- |
| Live verified doctors | 30 | 60 | Supply; 10 new/month |
| Paid bookings per doctor per day | 3 | 5 | Core revenue assumption |
| Monthly revenue | ₹30k+ (covers burn) | ₹75k+ | Self-sustaining pilot |
| Booking fee payment rate | 60% of bookings offered a fee | 75% | Tests willingness to pay |
| No-show rate on booked slots | Below 20% | Below 10% | Doctors' trust in bookings |
| Sessions with status set before start | 80% | 90% | Live status is believable |
| Wait estimate within ±15 min | 60% | 70% | Queue feature is useful |
| Reviews per doctor | 10+ | 25+ | Trust signal for new patients |
| Doctors still active after 3 months | 80% | 80% | Retention before subscription |
| Doctors who say we brought new patients | — | 60% | Gate for charging subscription |
| Repeat patients (2+ bookings in 60 days) | — | 30% | Patient-side value |

**Stop or change course** if at month 4 bookings are below 2 per doctor per day, or under 40% of patients pay the fee. Options then: drop the patient fee and move to doctor subscriptions earlier, or narrow to the specialties with the most demand.

## 12. Key risks and open questions

The biggest unknown is whether Tier-2/3 patients will pay ₹10–15 to book. Test it in the first month before anything else is built.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Patients will not pay a booking fee | Revenue model fails | Month 1 test: offer paid guaranteed slot vs free walk-in queue; track payment rate weekly |
| Doctors stop updating status | Live status becomes wrong; trust drops | 1-tap WhatsApp replies, receptionist as owner, ops call at 30 min, show "last updated" time |
| Empty platform at launch | Patients leave and do not return | Doctor-first onboarding and seeded reviews before discovery opens |
| Fake or hostile reviews | Brand promise breaks | Verified-visit rule, fraud checks, logged appeals (section 6.4) |
| Medical-council rules on advertising, fee sharing or rankings | Doctors exposed to complaints; platform forced to change | Lawyer review of the fee, subscription and ranking design before launch (inferred risk, not yet checked) |
| Practo or a local player copies the model in the city | Slower doctor signups | Density first: lock in 60 doctors and partners in one city before expanding |
| Founder is both builder and seller | Product or ops stalls | Manual ops for months 1–3 so the founder sells; build only what breaks |
| Payment gateway fees on small tickets | Thin margin on ₹10 | Confirm per-transaction minimums; consider ₹15 or prepaid packs |

### Open questions

- [ ] Which pilot city? Decide using the criteria in section 3.
- [ ] Brand name and visual identity for the network.
- [ ] Does the booking fee apply to all doctors or only anchors' guaranteed slots? Decide after the month 1 test.
- [ ] Lawyer review of Phase 2 health-record consent design (DPDP Act 2023, ABDM): per-visit OTP vs session consent. Who is the lawyer and what is the budget? It is not in the cost plan.
- [ ] Lawyer check that the patient fee and doctor subscription are allowed under medical-council professional conduct rules.
- [ ] Exact quality bar for staying in the network (minimum rating, complaint threshold, removal process).
- [ ] Which WhatsApp API provider (Interakt vs Gupshup), based on per-message pricing at expected volume.
- [ ] When the manual phase ends: which sign (for example, more than 50 bookings a day) triggers building the app.
