# Patient-Direct Splint Billing: Requirements and Brainstorm

Date: 2026-10-07
Status: Early requirements; no implementation decision

## Purpose

Explore patient payment at the time a clinic creates a splint, as an alternative to counting jobs and invoicing each clinic monthly. Immediate payment could improve cash flow and reduce accounts receivable work while still sharing revenue with the clinic.

This is a clean-slate billing capability. Splint Factory has no current billing subsystem.

## Non-Negotiable Workflow

- The therapist evaluates and measures the patient, selects the clinically appropriate splint design, generates and prints it, and verifies and adjusts its fit during one visit.
- The clinic remains clinically responsible, and accepts the associated professional liability, for design selection and proper fitting of the fabricated splint.
- Payment is requested during that visit but never gates design generation, printing, fitting, or clinical care.
- The patient pays Splint Factory through a mobile-friendly, provider-hosted checkout.
- The therapist can see a simple, current payment status without seeing card or unnecessary patient information.
- A patient who cannot pay immediately can take a secure link home and pay later.
- Splint Factory can reconcile gross collections, refunds, fees, its share, and each clinic's share.

## Recommended Initial Flow

1. The therapist creates a design job as usual.
2. Splint Factory creates one payment request for that job using the effective price and revenue-share terms, both snapshotted at that moment.
3. The job detail page shows the amount, payment status, QR code, and a copyable payment link.
4. The patient scans the QR code and pays on Stripe Checkout or an equivalent hosted page. Card data never passes through Splint Factory.
5. A signed payment-provider webhook updates the canonical payment status. The checkout return page is confirmation for the patient, not proof of payment for Splint Factory.
6. The already-open job page refreshes or polls and shows `Paid`, normally within seconds.
7. If payment is not completed, the therapist can select `Pay later`. The patient photographs a durable QR code or receives/prints a payment slip and can use the same request later.
8. Geometry processing and printing continue regardless of payment state.

The QR/link must represent a single payment request, not a reusable generic product link. A successful request must not accept a second payment.

## Pricing Requirements

- Support a price for every billable design/splint type.
- Start with a global price per design and allow an optional organization override. Do not require organization-specific pricing unless the business needs it.
- Store money as integer minor units and include currency.
- Effective-date price and revenue-share changes; do not rewrite historical transactions.
- Snapshot the patient price, clinic share, Splint Factory share, and relevant rule/version on the payment request.
- Restrict pricing changes to an explicit admin role and audit every change.
- Decide whether taxes and payment-processing fees are included in the displayed price and which party economically bears them.
- Decide what is billable: design job creation, first successful print, accepted/fitted splint, replacement, or reprint. The recommended pilot unit is one payment request per patient design job, with manual void/refund handling for failures.

## Payment State

Payment needs its own lifecycle, independent of processing and printing:

- `DUE`: request exists and can be paid
- `PROCESSING`: provider has not reached a final result
- `PAID`: funds were successfully captured
- `FAILED`: latest attempt failed; request remains payable
- `VOID`: no payment is due
- `PARTIALLY_REFUNDED`
- `REFUNDED`
- `DISPUTED`: chargeback or dispute is open

`Pay later` is a collection mode or follow-up state, not a claim that payment succeeded. The system should also record payment attempts and immutable provider events so retries, duplicate webhooks, and status corrections are explainable.

## Conceptual Data Boundaries

Exact schema is deferred, but billing will likely need these responsibilities:

- Organization billing configuration: enabled state, provider connected-account ID, onboarding/payout readiness, default share rate, and currency.
- Price schedule: design, optional organization, amount, effective dates, and author/editor.
- Payment request: design job, price/share snapshots, current status, secure public token, expiry/void state, and timestamps.
- Payment attempt: provider checkout/payment IDs, status, amount, and failure category. Do not store full card data.
- Financial ledger: append-only charge, refund, dispute, fee, share, transfer, and adjustment entries.
- Provider event receipt: event ID, processing result, and enough retained payload to support replay/audit under a defined retention policy.

The payment provider is the source of truth for movement of funds. Splint Factory's ledger is the source of truth for how those funds map to jobs, organizations, and reports.

## Patient Data and Privacy

### Data-minimizing baseline

Splint Factory does not need a patient account, name, email, phone number, billing address, or provider customer record to know that a job was paid. The recommended baseline is:

- Use a high-entropy public payment token that maps internally to a payment request.
- Send only an opaque billing-request identifier to provider metadata.
- Do not send measurements, diagnosis, design name, job label, therapist identity, or clinic notes to provider metadata, descriptions, receipts, logs, analytics, URLs, or support tools.
- Use a neutral patient-visible statement description and product description, reviewed for clarity and privacy.
- Let the payment provider collect only what is required to authorize payment and issue a receipt.
- Do not retrieve or persist payer identity in Splint Factory merely because the provider makes it available.
- Keep payment pages free of marketing analytics and session-replay tools.

A provider token does not automatically make the transaction anonymous. Splint Factory can still link it to a clinic, design job, and measurements. Treat billing identifiers and access logs as sensitive even when no patient name is stored.

### Questions requiring privacy/legal review

- Are Splint Factory and the clinic covered entities, business associates, independent service providers, or a combination depending on the transaction?
- HHS excludes a financial institution performing ordinary consumer payment-card/funds-transfer activity from business-associate status. Does the chosen provider remain within that narrow role, or do receipts, customer profiles, reporting, or richer metadata turn it into a billing service involving PHI?
- Does Splint Factory need a business associate agreement with each clinic or any payment/cloud vendor for the broader design workflow?
- Does a purchase linked to a prescribed/custom splint constitute consumer health data under Washington's My Health My Data Act even without HIPAA identifiers? Determine applicable notices, consent, processor contracts, access/deletion handling, retention, and geofencing/advertising restrictions.
- Define retention and deletion policies that preserve legally required financial records without retaining unnecessary health-linked data.

Avoiding patient identity substantially reduces exposure, but it is not by itself a conclusion that HIPAA or state health-data laws do not apply.

## Pay-Later Requirements

- A therapist can mark a still-unpaid request as `Pay later` without elevated billing authority.
- The secure URL must work without a Splint Factory login and reveal only the minimum information needed to verify the amount and merchant.
- The token must be unguessable, revocable, rate-limited, and replaceable if exposed.
- Define expiration and renewal behavior. A photographed or printed code should not silently become unusable too soon.
- Payment after leaving the clinic updates the same request and reports through the same webhook flow.
- Prefer a printed/copyable link for the pilot. Email or SMS would require a deliberate decision about who collects contact information, consent, delivery failures, and whether Splint Factory retains it. The clinic could deliver the link through its existing patient communication system.
- Define reminders, aging, write-off/waiver authority, and whether Splint Factory will perform collections. Do not let an overdue balance affect later clinical care without explicit policy and legal review.

## Revenue Sharing and Provider Choice

The business must first decide who is the seller/merchant presented to the patient. This affects receipts, card statement descriptors, refunds, disputes, tax, provider onboarding, and regulatory responsibility.

### Stripe Connect candidate

Stripe Connect destination charges can create the charge on the platform, immediately transfer the clinic's portion to its connected account, and return an application fee to Splint Factory. Stripe documents that the platform pays Stripe fees and is responsible for destination-charge disputes. This appears closest to "the patient directly pays Splint Factory," but clinics must complete connected-account identity/bank onboarding.

### Square candidate

Square can create hosted payment links and collect an application fee while processing on behalf of an OAuth-authorized clinic seller. Its default funds flow is more naturally clinic-as-seller, with the application's fee going to Splint Factory. This may be attractive if clinics already use Square, but it is a different commercial model from Splint Factory being the patient-facing merchant.

Provider selection should follow the merchant/legal decision, not precede it. Compare total fees, clinic onboarding friction, payout timing, refund/dispute allocation, reporting APIs, support, account freezes/reserves, healthcare contracting, and portability.

## Refunds, Disputes, and Exceptions

Plan for these before accepting the first live payment:

- Patient pays twice because of retries, multiple tabs, or two people scanning the code.
- Wrong design, organization, price, or share rate was selected.
- The design or all print attempts fail after payment.
- The splint is rejected, remade, replaced, or partially refunded.
- Patient pays after the request was voided or after terms changed.
- Webhook is delayed, duplicated, out of order, or missed.
- Provider shows paid while the local update failed, or vice versa.
- Charge is disputed after the clinic has been paid.
- Connected clinic account is not onboarded, is restricted, or has invalid payout details.
- Internet or the payment provider is unavailable during the visit.
- Patient wants cash, check, HSA/FSA, insurance reimbursement documentation, or another unsupported method.

Define who may refund or void, whether clinic approval is needed, how each adjustment reverses both parties' shares, and what the patient/clinic sees. All manual actions need actor, reason, timestamp, and audit event.

## Reporting and Reconciliation

### Splint Factory admin

- Transaction detail by date, organization, design, status, and provider reference.
- Gross charges, refunds, disputes, processor fees, taxes, Splint Factory share, clinic share, and net cash.
- Provider payout/transfer status and variances between provider totals and the internal ledger.
- Unpaid aging, pay-later conversion, failed payments, refunds, and dispute rates.
- Monthly close with a reproducible cutoff/time zone and CSV export.

### Clinic admin

- Its transactions only, including job/object identifier, patient price, status, clinic share, adjustments, and payout status.
- Monthly statement/export suitable for reconciliation.
- No payer identity unless a later, justified requirement explicitly introduces it.

Reports must calculate from immutable transaction snapshots and ledger entries, not current price/share configuration. A scheduled reconciliation should detect missing webhooks, amount mismatches, and orphan provider payments.

## Security and Reliability Requirements

- Provider-hosted checkout to minimize PCI scope; Splint Factory still completes the applicable annual PCI attestation.
- HTTPS, server-side secret storage, key rotation, least-privilege provider credentials, and separate test/live environments.
- Verify webhook signatures, persist provider event IDs, process idempotently, tolerate out-of-order events, and support controlled replay.
- Use idempotency keys when creating checkout/payment objects.
- Organization-scope every therapist/clinic query; reserve cross-organization reporting and refunds for system admins.
- Never expose provider secrets, internal sequential identifiers, or sensitive job data in the QR URL.
- Audit payment-request creation, pay-later activation, price changes, status overrides, voids, refunds, and exports.
- Alert on webhook failures, reconciliation differences, dispute creation, negative balances, and connected-account restrictions.

## Patient and Clinic Experience Impacts

- Clearly show price before the patient scans and again in hosted checkout.
- Clearly identify the merchant and support/refund contact on checkout, receipt, and card statement.
- Use large, high-contrast status labels: `Payment due`, `Processing`, `Paid`, `Pay later`, and `Refunded`.
- Do not show alarming unpaid warnings in the print controls; payment is informational and separate.
- Provide a manual refresh and display when status was last checked.
- Support mobile accessibility, common digital wallets, and an alternate path for patients who cannot use a QR code or smartphone.
- Train clinic staff on explaining the charge, pay later, refunds, duplicate charges, and where billing support goes. Therapists should not become payment troubleshooters.

## Business and Legal Decisions Before Build

1. Is Splint Factory or the clinic the merchant/seller to the patient?
2. Is the charge for a product, a service, or a combined item, and who sets the final patient price?
3. Is a percentage of each patient charge an appropriate clinic payment, or should the clinic receive a fixed fulfillment/service fee? Healthcare counsel should review federal/state anti-kickback, fee-splitting, self-referral, and device/orthotics rules, especially for federally reimbursed patients.
4. Will this be self-pay only? How are Medicare/Medicaid, insurance reimbursement, HSA/FSA eligibility, superbills, copays, and financial hardship handled?
5. Do No Surprises Act good-faith-estimate requirements apply to the clinic, Splint Factory, or both for scheduled uninsured/self-pay care?
6. Who owns refunds, disputes, chargeback losses, processing fees, sales/use tax, tax reporting, and patient support?
7. Can clinics choose prices? If so, what bounds, approvals, and patient-price consistency are required?
8. What happens to unpaid balances: reminders, clinic responsibility, write-off, or collections?
9. Which party's terms, privacy notice, refund policy, and receipt does the patient accept/receive?

These are launch blockers for fund flow and contracts, not reasons to block a technical prototype in provider test mode.

### Legal risk and proposed mitigations

Paying a clinic from a patient splint charge could be characterized as prohibited fee splitting or payment for referrals, especially if compensation is a percentage of sales or federal healthcare program business is involved. Patient disclosure is important for informed choice and conflicts, but disclosure alone may not cure an otherwise prohibited arrangement.

The clinic payment is intended to compensate real, documented work: patient evaluation and measurement, clinical design selection, local fabrication, fitting and adjustment, and the clinic's responsibility for design selection and fit. Before launch:

- Use a written clinic agreement that defines those duties, clinical independence, responsibility, liability, records, refunds, and compensation.
- Obtain and retain support that compensation is commercially reasonable and fair market value for services actually performed. Prefer a fixed fee for a defined service bundle over a percentage of the splint sale unless healthcare counsel approves another method.
- Do not condition payment on referrals, exclusivity, minimum volume, or use with federally reimbursed business. Preserve the clinician's independent judgment and the patient's available choices.
- Disclose before payment, in plain language, that the patient is paying Splint Factory and that the clinic receives compensation for its measurement, selection, fabrication, and fitting services. Keep a record of the disclosure.
- Require the clinic to document the services performed, clinical rationale, objective measurements, design selected, fitting outcome, and adjustments.
- Define whether the option is strictly self-pay and prohibit insurance or federal-program claims until counsel approves the payer and billing rules.
- Obtain Washington healthcare counsel's written approval of the final merchant, fund-flow, compensation, disclosure, and liability structure before production launch.

## Suggested Pilot Scope

- One clinic and a small set of splint designs.
- One currency and card/digital-wallet payments through hosted checkout.
- Global design prices with optional pilot-clinic overrides.
- One snapshotted, counsel-approved clinic service-fee schedule, preferably a fixed fee for a defined service bundle.
- QR plus copy/print link; no patient contact data and no automated reminders.
- Payment status on job detail and job list; no print gating.
- System-admin transaction report, clinic monthly statement, refund/void controls, and reconciliation.
- Test scenarios for successful, failed, abandoned, delayed, duplicate, refunded, disputed, and out-of-order webhook cases.

Success measures: checkout completion rate during the visit, pay-later completion rate, time from request to payment, staff time per payment, support/refund rate, reconciliation variance, and clinic/patient feedback.

## Sources Reviewed

- [Stripe Connect destination charges](https://docs.stripe.com/connect/destination-charges)
- [Stripe application fees and funds flow](https://docs.stripe.com/connect/marketplace/tasks/app-fees)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Stripe Payment Link QR codes](https://docs.stripe.com/payment-links/share)
- [Stripe metadata guidance](https://docs.stripe.com/metadata)
- [Stripe integration and PCI security](https://docs.stripe.com/security/guide)
- [Square hosted Checkout API](https://developer.squareup.com/docs/checkout-api)
- [Square application fees](https://developer.squareup.com/docs/payments-api/take-payments-and-collect-fees)
- [Square webhook delivery behavior](https://developer.squareup.com/docs/webhooks/overview)
- [HHS covered entities and business associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html)
- [HHS business-associate guidance, including ordinary financial transactions](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html)
- [HHS minimum necessary guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html)
- [Washington Attorney General: My Health My Data Act](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy)
- [HHS OIG fraud and abuse laws](https://oig.hhs.gov/compliance/physician-education/fraud-abuse-laws/)
- [CMS good faith estimate guidance](https://www.cms.gov/medical-bill-rights/help/guides/good-faith-estimate)

This note identifies issues for professional review and is not legal, tax, accounting, or compliance advice.