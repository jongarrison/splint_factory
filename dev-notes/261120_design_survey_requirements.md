# Splint Design Survey

Status: v1 implemented; deployment requires the [database migration](../prisma/migrations/20261123190000_add_design_survey_responses/migration.sql). The [public Google Form](https://docs.google.com/forms/d/e/1FAIpQLScjC3vXPxVUK1KGxqX4ZRLhFs4WVeC3bXnbdyMl3TWGymlvEw/viewform) is the source for the six questions.

## Goal

Let signed-in users give feedback on splint fit, design, and print quality without leaving Splint Factory. Capture the same six answers without copying Google's layout, sign-in, or draft-saving behavior.

## Questions

| Prompt | Answer |
| --- | --- |
| Which splint design are you providing feedback on? | Single choice from the splint designs available to the user's organization |
| Please provide the alphanumeric splint code (Object ID). | Short text |
| How would you rate the fit of this design for your patient? | Integer 1-5, from Poor (1) to Excellent (5) |
| Are there any modifications to the geometry or features that would make this design more effective? | Multi-line text |
| How satisfied are you with the quality of your prints? | Single choice: Very Satisfied, Satisfied, Neutral, Dissatisfied, Very Dissatisfied |
| Please provide any comments to improve our platform or splint designs. | Multi-line text |

Require a splint design and at least one of the four feedback answers. Object ID is optional from either entry point. Leave ratings unselected by default so an unanswered rating is not recorded as neutral.

## User access and submission

- **User menu > Splint Design Survey** is the direct link for hand therapists. Add it to the existing [User menu](../src/components/navigation/Header.tsx), not the Tools menu. It opens a blank survey. Use the existing signed-in organization membership, not a new therapist role. An account without an organization cannot submit.
- **Design job > Splint Design Survey** opens the same form from the [design job page](../src/app/design-jobs/%5Bid%5D/page.tsx). For a splint job in the submitter's organization, check job access on the server and prefill the design and Object ID. Both stay editable; a missing Object ID stays blank. The job supplies defaults only; the response records the submitted values, not a link to a job or revision.
- Reuse the [existing design visibility rules](../src/app/api/designs/route.ts) to offer only active splint designs available to the submitter's organization, excluding tools. If a job's design is no longer available, explain why it cannot be prefilled and offer the blank survey instead. If there are no eligible designs, explain that and disable submission.
- Use a single page with existing form styles, accessible labels, and inline validation. The survey is voluntary and separate from **Review Print**; it never changes print acceptance, design revisions, or queue state.
- Save each submission with the six answers, the form version the user saw, the signed-in user's ID, the organization at submission, and a timestamp. Allow intentional repeat submissions and prevent accidental duplicates from double-clicks or retries.
- Require a valid app session and derive user and organization context on the server. Recheck design availability on submit. Validate feedback against the submitted form version, trim and limit text, and leave skipped answers unset. An entered Object ID need not match a job and must not expose another organization's data.
- Confirm only after the response is saved. Submitters see a confirmation, not response history or admin notes. If saving fails, keep answers on the page and let the user retry. Tell users not to include patient names or other identifying details in comments. Treat splint codes and responses as potentially sensitive and keep answers out of routine logs and analytics.

## Admin review

- **Tools > System Administration > Splint Design Survey Responses** links to the review page from the existing [header navigation](../src/components/navigation/Header.tsx). Only System Admins can list and open responses or save reviews across organizations. Enforce that role on the server for all three actions, not just in navigation.
- Show a newest-first list with submission date, organization, submitter, splint design, and read status. Opening a response shows the questions and answers for its saved form version.
- Responses start unread. Opening one does not mark it read. Each response has one shared **Mark as read** checkbox, one editable internal note, and a **Save** action. An admin can uncheck and save to mark the response unread again.
- Show the saved read status, note, and last updating admin's name alongside the original answers. Record the last updating admin's identity and name from their session, and when they saved. Do not retain a review history or modify the original submission.
- Defer advanced filters, exports, reporting, reminders, Google sync or import, and respondent history or editing. Start with the list, detail view, and shared note/read controls.

## Retention and deletion

- Keep survey responses and their admin review data until explicitly deleted. There is no automatic expiration or scheduled cleanup.
- In v1, an authorized operator handles deletion outside the app. Delete the response and its associated admin review data together. The admin page does not offer a delete action.

## Form versioning

- Keep published form definitions in code, starting with v1. Each definition includes stable question IDs, prompts, answer choices, and validation rules. Keep published definitions unchanged and available for as long as their responses are retained. No form builder is needed in v1.
- Publish a new version when questions, wording, choices, or validation rules change. Keep the same question ID for wording changes that preserve meaning; use a new ID when the meaning or scale changes so incompatible answers are not compared as one measure.
- Save and validate against the version the user saw, not the latest version. On review, render the saved version's prompts and choice labels. A missing answer to a question in that version means **Skipped**; a question introduced later was **Not asked**.

## Acceptance checks

- A regular organization member can open the blank form from the User menu and the prefilled form from a design job. Both entry points offer only their organization's active splints. A job without an Object ID can still be used to submit; an inaccessible or cross-organization job cannot supply prefill.
- A signed-in user can answer all six questions. A design and one feedback answer are sufficient to save; a design without feedback is rejected and omitted answers stay unset.
- Signed-out submissions, unknown form versions or question IDs, and invalid answer types, ratings, or choices are rejected server-side.
- A retry does not create a duplicate; a deliberate new submission is allowed. A failed save keeps the user's answers and does not show success.
- Verify that validation and admin display use the stored version definition. Only v1 ships at launch; when a later version is added, test that an already-open form still submits against its original definition and older responses keep their original prompts and choice labels.
- Submitting leaves **Review Print** and the print and design queues unchanged.
- A System Admin can find the review page through navigation, see submissions across organizations, and save a note or mark a response read or unread. Opening a response leaves its status unchanged. Reopening shows the saved status, note, and last updating admin alongside the unchanged answers. Regular members and Organization Admins cannot list or open responses or save reviews, even if they navigate directly.

## Database schema

Use one PostgreSQL table, `DesignSurveyResponse`, in the existing [Prisma schema](../prisma/schema.prisma). Keep submission metadata, design and Object ID, and admin review state in typed columns. Store the four v1 feedback answers in a versioned `jsonb` object so question changes do not require a database migration. Keep the current review on the response row so operator deletion removes both together.

```prisma
model DesignSurveyResponse {
  id                    String               @id @default(cuid())
  createdAt             DateTime             @default(now())
  submittedByUserId     String
  organizationId        String
  submissionKey         String               @db.Uuid

  designId              String
  objectId              String?
  formVersion           Int
  answers               Json                 @db.JsonB

  isRead                Boolean              @default(false)
  adminNote             String?
  lastReviewedByUserId  String?
  lastReviewedByName    String?
  lastReviewedAt        DateTime?

  submittedBy           User                 @relation("SubmittedDesignSurveys", fields: [submittedByUserId], references: [id], onDelete: Restrict)
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  design                Design               @relation(fields: [designId], references: [id], onDelete: Restrict)
  lastReviewedBy        User?                @relation("ReviewedDesignSurveys", fields: [lastReviewedByUserId], references: [id], onDelete: Restrict)

  @@unique([submittedByUserId, submissionKey])
  @@index([createdAt, id])
}

```

- Store the organization at submission rather than deriving it later from the user's current membership. Relate the response to the selected `Design`, not a design job or revision. `objectId` is optional text, not a foreign key or a unique value.
- `answers` is an object keyed by stable question IDs. In v1, `fitRating` is an integer from 1 through 5, `designSuggestions` and `additionalComments` are strings, and `printSatisfaction` is a stable choice code (for example, `VERY_SATISFIED`). Omit keys for skipped answers and whitespace-only feedback; store an omitted Object ID as SQL `NULL`.
- Validate design availability and enforce version-specific answer types, choices, ranges, and required feedback on the server rather than encoding question-specific constraints in the database.
- Generate one `submissionKey` per intended submission and reuse it for retries. The unique constraint prevents a duplicate row; a retry must not overwrite the saved answers.
- Save `isRead`, `adminNote`, and the last admin's ID, display name, and timestamp together on an explicit admin save, without changing submission data. Use the account email as the display-name fallback if the admin has no name. Leave the review metadata unset until the first save.
- `User`, `Organization`, and `Design` have inverse relations for survey responses. `Restrict` prevents deletion of a referenced record from silently deleting feedback; an authorized operator handles deliberate survey deletion separately.
