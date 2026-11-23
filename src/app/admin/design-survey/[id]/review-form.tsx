'use client';

import { startTransition, useActionState, useState } from 'react';
import { ADMIN_NOTE_MAX_LENGTH } from '@/lib/design-survey';
import { saveSurveyReview } from './actions';

export default function ReviewForm({ responseId, isRead, note, reviewedBy, reviewedAt }: {
  responseId: string;
  isRead: boolean;
  note: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}) {
  const [state, save, pending] = useActionState(saveSurveyReview.bind(null, responseId), {});
  const [checked, setChecked] = useState(isRead);
  const [comment, setComment] = useState(note);
  const [edited, setEdited] = useState(false);

  return (
    <form action={save} className="card p-6 space-y-4" onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      setEdited(false);
      startTransition(() => save(data));
    }}>
      <h2 className="text-lg font-semibold">Admin review</h2>
      <p className="text-sm text-secondary">
        {isRead ? 'Read' : 'Unread'}{reviewedBy ? ` | Last updated by ${reviewedBy} on ${reviewedAt}` : ''}
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isRead" checked={checked}
          onChange={event => { setChecked(event.target.checked); setEdited(true); }} />
        Mark as read
      </label>
      <div>
        <label htmlFor="admin-note" className="block font-medium">Internal admin note</label>
        <textarea id="admin-note" name="note" value={comment} rows={4} maxLength={ADMIN_NOTE_MAX_LENGTH}
          className="input-field mt-1 w-full" onChange={event => { setComment(event.target.value); setEdited(true); }} />
      </div>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.saved && !edited && !pending && <p role="status">Review saved.</p>}
      <button type="submit" className="btn-primary px-4 py-2" disabled={pending}>{pending ? 'Saving...' : 'Save review'}</button>
    </form>
  );
}
