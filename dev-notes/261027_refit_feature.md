# Refit Feature

## Current behavior

- Refit updates an existing clinical design job, increments its 1-based revision, and requeues geometry processing.
- Pending print jobs are soft-deleted. Running and completed prints remain as history.
- Each print snapshots the design revision and input parameters it used.
- Refit actions and processing results are associated with the design job audit history.
- Refit is available to organization users. Reprocess and New Test Variant remain System Admin-only.
- A short print-preparation lease protects the source file while a Splintbot downloads, uploads, and starts a print.

## Future concerns

- Preparation claims are currently anonymous. Add a `preparingDeviceId` so the same Splintbot can renew/retry its claim, only the owner can release it, and stale takeovers are attributable.
- Refit should not create a new revision when design inputs are unchanged or only the queue label changes.
- Pass the revision to geometry generators and mark revisions 2-9 on the physical orthosis in a design-specific location. Revision 1 can remain unmarked for backward compatibility. Define behavior before revision 10.
- Audit retention should not be the only source of long-term clinical or billing history. Print input snapshots are durable, but prior geometry files and processing logs are replaced by refit.
- Billing should treat the initial clinical design as potentially billable and its refits as free. Do not infer billing solely from user role or audit events.
- If stronger manufacturing traceability becomes necessary, consider separating the clinical design identity from immutable design revisions rather than continuing to replace outputs on one DesignJob.
