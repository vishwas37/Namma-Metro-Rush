import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KANNADA_VOICE_OVER_PHRASES,
  getSpeechPayload,
  pickVoiceOverPhrase,
  selectPreferredSpeechVoice,
  type VoiceOverEvent,
} from './voiceOver';

test('all voice-over pools are populated and include signature Kannada phrases', () => {
  const events: VoiceOverEvent[] = ['run_start', 'kaapi', 'magnet', 'drone', 'hoverboard'];
  for (const event of events) {
    const pool = KANNADA_VOICE_OVER_PHRASES[event];
    assert.ok(pool.length >= 4, `Expected >=4 phrases for ${event}`);
    for (const phrase of pool) {
      assert.equal(phrase.event, event);
      assert.ok(phrase.romanized.trim().length > 0);
      assert.ok(phrase.kannada.trim().length > 0);
      assert.ok(phrase.meaning.trim().length > 0);
    }
  }

  const startTexts = KANNADA_VOICE_OVER_PHRASES.run_start.map((p) => p.romanized);
  assert.ok(
    startTexts.includes('Run, Nimma time barutte!'),
    'run_start should include "Run, Nimma time barutte!"',
  );

  const allPowerUpTexts = [
    ...KANNADA_VOICE_OVER_PHRASES.kaapi,
    ...KANNADA_VOICE_OVER_PHRASES.magnet,
    ...KANNADA_VOICE_OVER_PHRASES.drone,
    ...KANNADA_VOICE_OVER_PHRASES.hoverboard,
  ].map((p) => p.romanized);
  assert.ok(
    allPowerUpTexts.some((t) => t.startsWith('Oh, nodi!')),
    'power-up pools should include "Oh, nodi!"',
  );
});

test('pickVoiceOverPhrase avoids repeating the previous phrase back-to-back', () => {
  const first = KANNADA_VOICE_OVER_PHRASES.run_start[0];
  for (let i = 0; i < 12; i++) {
    const picked = pickVoiceOverPhrase('run_start', first.id, () => i / 12);
    assert.notEqual(picked.id, first.id, 'should not repeat immediately previous phrase');
  }
});

test('selectPreferredSpeechVoice prioritizes kn-IN, then en-IN, then English fallback', () => {
  const allVoices = [
    { lang: 'fr-FR', name: 'French' },
    { lang: 'en-US', name: 'US English' },
    { lang: 'en-IN', name: 'Indian English' },
    { lang: 'kn-IN', name: 'Kannada India' },
  ];
  assert.equal(selectPreferredSpeechVoice(allVoices)?.lang, 'kn-IN');

  const noKannada = allVoices.filter((v) => !v.lang.startsWith('kn'));
  assert.equal(selectPreferredSpeechVoice(noKannada)?.lang, 'en-IN');

  const onlyUs = [{ lang: 'en-US', name: 'US English' }];
  assert.equal(selectPreferredSpeechVoice(onlyUs)?.lang, 'en-US');
  assert.equal(selectPreferredSpeechVoice([]), null);
});

test('getSpeechPayload uses native Kannada script for kn voices and romanized text for non-kn voices', () => {
  const phrase = KANNADA_VOICE_OVER_PHRASES.run_start[0];
  const knPayload = getSpeechPayload(phrase, { lang: 'kn-IN', name: 'Google Kannada' });
  assert.equal(knPayload.text, phrase.spokenKn);
  assert.equal(knPayload.lang, 'kn-IN');

  const enInPayload = getSpeechPayload(phrase, { lang: 'en-IN', name: 'Rishi' });
  assert.equal(enInPayload.text, phrase.spokenEnIn);
  assert.equal(enInPayload.lang, 'en-IN');

  const fallbackPayload = getSpeechPayload(phrase, null);
  assert.equal(fallbackPayload.text, phrase.spokenEnIn);
  assert.equal(fallbackPayload.lang, 'en-IN');
});
