type Choice = { value: string; label: string };
type Question = { id: string; prompt: string } & (
  | { kind: 'text'; maxLength: number }
  | { kind: 'rating' | 'choice'; choices: readonly Choice[] }
);

export const OBJECT_ID_MAX_LENGTH = 64;
export const ADMIN_NOTE_MAX_LENGTH = 4000;
export const CURRENT_SURVEY_VERSION = 1;

const versions: ReadonlyMap<number, readonly Question[]> = new Map([
  [1, [
    {
      id: 'fitRating',
      prompt: 'How would you rate the fit of this design for your patient?',
      kind: 'rating',
      choices: [
        { value: '1', label: '1 (Poor)' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
        { value: '5', label: '5 (Excellent)' },
      ],
    },
    {
      id: 'designSuggestions',
      prompt: 'Are there any modifications to the geometry or features that would make this design more effective?',
      kind: 'text',
      maxLength: 4000,
    },
    {
      id: 'printSatisfaction',
      prompt: 'How satisfied are you with the quality of your prints?',
      kind: 'choice',
      choices: [
        { value: 'VERY_SATISFIED', label: 'Very Satisfied' },
        { value: 'SATISFIED', label: 'Satisfied' },
        { value: 'NEUTRAL', label: 'Neutral' },
        { value: 'DISSATISFIED', label: 'Dissatisfied' },
        { value: 'VERY_DISSATISFIED', label: 'Very Dissatisfied' },
      ],
    },
    {
      id: 'additionalComments',
      prompt: 'Please provide any comments to improve our platform or splint designs.',
      kind: 'text',
      maxLength: 4000,
    },
  ]],
]);

export function getSurveyQuestions(version: number) {
  return versions.get(version);
}

export type SurveyAnswers = Record<string, string | number>;

export function readSurveyAnswers(version: number, data: FormData):
  | { answers: SurveyAnswers }
  | { error: string; field?: string } {
  const questions = getSurveyQuestions(version);
  if (!questions) return { error: 'This survey version is not available. Reopen the survey and try again.' };

  const byId = new Map(questions.map(question => [question.id, question]));
  const answers: SurveyAnswers = {};
  const seen = new Set<string>();
  for (const [key, raw] of data) {
    if (!key.startsWith('answer:')) continue;
    const id = key.slice('answer:'.length);
    const question = byId.get(id);
    if (!question || seen.has(id) || typeof raw !== 'string') {
      return { error: 'The survey contains an invalid answer.' };
    }
    seen.add(id);
    const value = question.kind === 'text' ? raw.trim() : raw;
    if (!value) continue;
    if (question.kind === 'text') {
      if (value.length > question.maxLength || value.includes('\0')) {
        return { error: `Enter valid text of at most ${question.maxLength} characters.`, field: id };
      }
    } else if (!question.choices.some(choice => choice.value === value)) {
      return { error: 'Select one of the available choices.', field: id };
    }
    answers[id] = question.kind === 'rating' ? Number(value) : value;
  }
  if (!Object.keys(answers).length) return { error: 'Answer at least one feedback question.' };
  return { answers };
}
