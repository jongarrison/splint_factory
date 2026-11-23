'use client';

import { startTransition, useActionState, useState } from 'react';
import { CURRENT_SURVEY_VERSION, getSurveyQuestions, OBJECT_ID_MAX_LENGTH } from '@/lib/design-survey';
import { submitDesignSurvey } from './actions';

export default function SurveyForm({
  designs, submissionKey, initialDesignId, initialObjectId,
}: {
  designs: { id: string; name: string }[];
  submissionKey: string;
  initialDesignId: string;
  initialObjectId: string;
}) {
  const [state, submit, pending] = useActionState(submitDesignSurvey, {});
  const [requestKey] = useState(submissionKey);
  const [designId, setDesignId] = useState(initialDesignId);
  const [objectId, setObjectId] = useState(initialObjectId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = getSurveyQuestions(CURRENT_SURVEY_VERSION);

  if (state.saved) {
    return <p className="card p-6" role="status">Thank you. Your feedback was saved.</p>;
  }
  if (!questions) throw new Error('Current design survey version is missing');

  function errorProps(field: string) {
    const invalid = state.field === field;
    return { 'aria-invalid': invalid || undefined, 'aria-describedby': invalid ? 'survey-error' : undefined };
  }

  return (
    <form action={submit} onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => submit(data));
    }} className="card p-6 space-y-5">
      <input type="hidden" name="submissionKey" value={requestKey} />
      <input type="hidden" name="formVersion" value={CURRENT_SURVEY_VERSION} />
      <div>
        <label htmlFor="designId" className="block font-medium">Which splint design are you providing feedback on?</label>
        <select id="designId" name="designId" required className="input-field mt-1 w-full"
          value={designId} onChange={event => setDesignId(event.target.value)} {...errorProps('designId')}>
          <option value="">Choose a splint design</option>
          {designs.map(design => <option key={design.id} value={design.id}>{design.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="objectId" className="block font-medium">Splint code (Object ID, optional)</label>
        <input id="objectId" name="objectId" className="input-field mt-1 w-full" maxLength={OBJECT_ID_MAX_LENGTH}
          value={objectId} onChange={event => setObjectId(event.target.value)} {...errorProps('objectId')} />
      </div>
      <p className="text-sm text-secondary">Answer at least one feedback question. Do not include patient names or other identifying details.</p>
      {questions.map(question => {
        const name = `answer:${question.id}`;
        const value = answers[question.id] ?? '';
        const onChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
          const next = event.target.value;
          setAnswers(previous => ({ ...previous, [question.id]: next }));
        };
        return (
          <div key={question.id}>
            <label htmlFor={question.id} className="block font-medium">{question.prompt}</label>
            {question.kind === 'text' ? (
              <textarea id={question.id} name={name} value={value} onChange={onChange} rows={3}
                maxLength={question.maxLength} className="input-field mt-1 w-full" {...errorProps(question.id)} />
            ) : (
              <select id={question.id} name={name} value={value} onChange={onChange}
                className="input-field mt-1 w-full" {...errorProps(question.id)}>
                <option value="">No answer</option>
                {question.choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            )}
          </div>
        );
      })}
      {state.error && <p id="survey-error" role="alert" className="alert-error">{state.error}</p>}
      <button type="submit" className="btn-primary px-4 py-2" disabled={pending}>{pending ? 'Saving...' : 'Submit feedback'}</button>
    </form>
  );
}
