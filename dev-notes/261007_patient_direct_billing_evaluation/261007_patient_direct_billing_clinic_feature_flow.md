# Patient-Direct Billing: Draft Feature Flow

Date: 2026-10-07

## Purpose

This document describes our current understanding of the discussed patient-direct billing option. It is intended as a first draft of how the feature should work for clinic staff and patients before we design or build it.

The main idea is to let the patient pay for the splint during the visit instead of Splint Factory counting completed splints and invoicing the clinic at the end of the month. The clinic would receive an agreed portion or service fee for its measurement, design selection, local fabrication, fitting, and adjustment work.

## Goals

- Keep the therapist's current splint workflow simple.
- Let the patient pay quickly from a phone during the visit.
- Allow payment later when payment during the visit is not practical.
- Never block splint creation, printing, or fitting because of payment status.
- Give clinic staff a clear payment status without making them handle card information.
- Give the clinic a clear record of transactions, adjustments, and amounts owed or paid to the clinic.

## Proposed Visit Flow

1. The therapist evaluates and measures the patient, selects the appropriate splint design, and creates the design job as usual.
2. Splint Factory creates one payment request for that job using the agreed price for the selected splint.
3. The job page displays the patient price, current payment status, a QR code, and a copyable payment link.
4. The patient scans the QR code and opens a simple, mobile-friendly checkout page.
5. The patient pays by card or supported digital wallet. Splint Factory does not receive or store the patient's card details. Payment is handled by a third party biller (a Stripe like servie) as possible.
6. The job page updates to show `Paid`, normally within a few seconds.
7. The therapist continues generating, printing, fitting, and adjusting the splint regardless of whether payment has been completed.

Note: Each job has its own payment link. Once that request has been paid, the same link cannot create a second payment.

## Pay Later

If the patient cannot or does not want to pay during the visit, the therapist can select `Pay later`.

- The patient can photograph the QR code, copy the link, receive an email with payment info or receive a printed payment slip.
- The clinic may also send the link through its existing patient communication system.
- The same page remains available after the visit and updates the original job when payment is completed.
- Splint creation and fitting continue normally. `Pay later` is not treated as a clinical hold.
- The initial version would not collect patient email addresses or phone numbers or send automatic reminders.

## What Clinic Staff See

On the splint job, clinic staff would see simple statuses such as:

- `Payment due`
- `Processing`
- `Paid`
- `Pay later`
- `Refunded`

The page would also show when the status was last checked and provide a manual refresh if needed. Payment information should remain separate from the main print controls so an unpaid balance does not look like a printing error or clinical warning.

Clinic administrators would have access to their clinic's transactions, including:

- Splint job or object identifier
- Patient price
- Payment status and date
- Clinic portion or service fee
- Refunds or other adjustments
- Payout status
- Monthly statement or export for reconciliation

Note: Patient names and card information would not appear in Splint Factory's clinic billing reports.

## Pricing and Clinic Payment

- Each billable splint design can have an established patient price.
- A per clinic-specific price can be supported if we agree that it is needed.
- The price shown when the payment request is created remains attached to that job even if prices change later.
- The clinic's agreed portion or service fee is also recorded when the request is created.
- Refunds and adjustments should handled in such a way that it is clear on the periodic statement.

## Common Exceptions

The initial version should handle these situations clearly:

- A card payment fails and the patient wants to try again.
- The patient leaves checkout before finishing and pays later.
- A patient or family member opens the link more than once.
- The wrong splint or price was selected before payment.
- Printing fails or the splint needs to be remade.
- A payment needs to be voided, partially refunded, or fully refunded.
- The internet or payment service is temporarily unavailable.
- The patient asks to use cash, check, HSA/FSA funds, or another unsupported payment method.

For the pilot, unusual cases can be handled manually by an authorized administrator as long as the reason and resulting adjustment are visible in the transaction record.

## Some of the supporting pieces that would need to be created

- Card and digital-wallet payment through mobile checkout.
- Design job details page payment QR code plus copyable and printable pay-later link.
- Payment status on the job detail page and job list.
- No patient contact information or automatic reminders stored by Splint Factory. Third party payment token to be researched for the verification of payment status.
- Clinic transaction view and monthly statement.
- Manual refund and void controls for authorized administrators.
- Payment implementation remains completely separate from design generation and printing.

During early testing, we would review checkout completion, pay-later use, staff time, refunds, failed payments, reporting accuracy, and feedback from clinic staff and patients.

## More Items to Confirm Together

- Who should set the patient price, and does the clinic need clinic-specific pricing?
- What is the clinic fee sharing rate 
- What is the expected clinic portion payout schedule?
- Who at the clinic should be allowed to mark `Pay later`, void a request, or request a refund?
- Who should follow up on unpaid pay-later requests, and after how long?
- How should failed prints, remakes, rejected splints, and replacements affect the charge? I think it is same as before, as many remakes or refits as the therapist deems necessary would be included in the price.
- Should the pilot accept only online card and wallet payments, or must cash, check, or HSA/FSA payment be supported?
- What information does the clinic need on its transaction list and monthly statement? Is the imprinted 4 character objectId sufficient for reconciling records?
- What would make the pilot successful from the clinic's perspective?
