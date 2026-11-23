import assert from 'node:assert/strict';
import test from 'node:test';
import { readSurveyAnswers } from './design-survey';

test('v1 stores only answered questions using stable IDs and typed values', () => {
  const data = new FormData();
  data.set('answer:fitRating', '5');
  data.set('answer:printSatisfaction', 'VERY_SATISFIED');
  data.set('answer:designSuggestions', '  Adjust the curve.  ');
  data.set('answer:additionalComments', '  ');
  assert.deepEqual(readSurveyAnswers(1, data), {
    answers: { fitRating: 5, printSatisfaction: 'VERY_SATISFIED', designSuggestions: 'Adjust the curve.' },
  });
});

test('blank feedback, invalid values, and answers not in the published version are rejected', () => {
  const data = new FormData();
  data.set('answer:designSuggestions', '  ');
  assert.equal('error' in readSurveyAnswers(1, data), true);
  data.set('answer:fitRating', '6');
  assert.equal('error' in readSurveyAnswers(1, data), true);
  data.set('answer:fitRating', '3');
  assert.equal('error' in readSurveyAnswers(2, data), true);
  data.set('answer:notInVersion', 'text');
  assert.equal('error' in readSurveyAnswers(1, data), true);
});
