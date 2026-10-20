import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createClaudeProvider } from '../src/llm.js';
import { parseScores, scoreInstruction } from '../src/skill.js';
import { overall, level, LEVEL_WINDOW } from '../public/js/skill.js';

const s = (recognition, boundaries, composure) => ({ recognition, boundaries, composure });

test('parseScores splits prose from the score line and clamps values', () => {
  const r = parseScores('Хороший разбор.\n• совет\nОЦЕНКА {"recognition":7,"boundaries":12.4,"composure":-3}');
  assert.equal(r.feedback, 'Хороший разбор.\n• совет');
  assert.deepEqual(r.scores, s(7, 10, 0));
});

test('parseScores tolerates missing or broken score lines', () => {
  assert.deepEqual(parseScores('Просто текст'), { feedback: 'Просто текст', scores: null });
  assert.deepEqual(parseScores('Текст\nОЦЕНКА {broken'), { feedback: 'Текст', scores: null });
  assert.deepEqual(parseScores('Текст\nОЦЕНКА {"recognition":5}'), { feedback: 'Текст', scores: null });
  assert.deepEqual(parseScores(null), { feedback: null, scores: null });
  assert.deepEqual(parseScores('ОЦЕНКА {"recognition":5,"boundaries":5,"composure":5}'), { feedback: null, scores: null });
});

test('parseScores keeps prose that merely mentions the marker and rejects non-numeric values', () => {
  const prose = 'ОБЩАЯ ОЦЕНКА: вы держались уверенно.\nДальше — советы.';
  assert.deepEqual(parseScores(prose), { feedback: prose, scores: null });
  const nulls = 'Текст\nОЦЕНКА {"recognition":null,"boundaries":"","composure":true}';
  assert.deepEqual(parseScores(nulls), { feedback: 'Текст', scores: null });
});

test('parseScores strips markdown decoration and keeps text after the score line', () => {
  const r = parseScores('Разбор.\n```json\n**ОЦЕНКА:** {"recognition":6,"boundaries":4,"composure":8}\n```\nУдачи!');
  assert.equal(r.feedback, 'Разбор.\n\nУдачи!');
  assert.deepEqual(r.scores, s(6, 4, 8));
});

test('scoreInstruction names every axis and the marker', () => {
  const text = scoreInstruction();
  for (const k of ['recognition', 'boundaries', 'composure', 'ОЦЕНКА']) assert.match(text, new RegExp(k));
});

test('overall and level average the latest sparrings', () => {
  assert.equal(overall(s(6, 7, 8)), 7);
  assert.equal(overall(s(5, 5, 6)), 5.3);
  assert.equal(level([]), null);
  const history = [...Array(LEVEL_WINDOW).fill({ scores: s(8, 8, 8) }), { scores: s(0, 0, 0) }];
  assert.equal(level(history), 8); // older than the window: ignored
});

test('POST /api/debrief returns scores separately and keeps them out of the feedback', async () => {
  const calls = [];
  const client = {
    beta: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Разбор.\nОЦЕНКА {"recognition":6,"boundaries":4,"composure":8}' }] };
        },
      },
    },
  };
  const res = await request(createApp({ llm: createClaudeProvider(client) }))
    .post('/api/debrief')
    .send({
      scenario: 'first-meeting',
      intro: 0,
      personaId: 'grandiose-narcissist',
      guess: 'avoidant',
      messages: [{ role: 'assistant', content: 'Привет' }, { role: 'user', content: 'Привет' }],
    })
    .expect(200);
  assert.equal(res.body.data.feedback, 'Разбор.');
  assert.deepEqual(res.body.data.scores, s(6, 4, 8));
  assert.match(calls[0].system, /ОЦЕНКА/);
});
