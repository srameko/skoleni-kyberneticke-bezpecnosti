#!/usr/bin/env node
/**
 * CyberQuest — Translation integrity tests
 *
 * Validates that all language entries in LANG and SCENARIO_TRANSLATIONS
 * are structurally complete and match the English baseline.
 *
 * Usage:  node test.js
 */

'use strict';

// ── Load the translation data ─────────────────────────────────────────────────
// translations.js uses const declarations at top level; wrap the source so the
// variables are accessible from our test scope.
const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const src  = fs.readFileSync(path.join(__dirname, 'translations.js'), 'utf8');
// Wrap in a function that returns the two translation objects
const wrapped = `(function() {
  ${src}
  return { LANG, SCENARIO_TRANSLATIONS };
})()`;

const ctx = vm.createContext({});
const { LANG, SCENARIO_TRANSLATIONS } = vm.runInContext(wrapped, ctx);

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed  = 0;
let failed  = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push('  FAIL: ' + message);
  }
}

// ── 1. LANG: required UI string keys ─────────────────────────────────────────
const REQUIRED_LANG_KEYS = [
  'tagline', 'welcomeTitle', 'welcomeDesc', 'nameLabel', 'namePlaceholder',
  'startBtn', 'menuIntro', 'scoreLabel', 'scenariosLabel', 'streakLabel',
  'correct', 'wrong', 'continueBtn', 'backBtn', 'keyTakeaways',
  'scenarioComplete', 'scenarioScore', 'scenariosDone', 'totalScore',
  'viewCert', 'trainingComplete', 'congratsMsg', 'certOrg', 'certTitle',
  'certSubtitle', 'thisCertifies', 'certDesc', 'certScoreLabel',
  'certAwardedOn', 'downloadCert', 'completedBadge', 'viewCertBtn',
  'outlookInbox', 'deviceCodeLabel', 'emailFrom', 'emailTo', 'emailSubject',
  'diffMedium', 'diffHard', 'dateLocale'
];

const SUPPORTED_LANGS = Object.keys(LANG);

console.log('\n=== CyberQuest Translation Tests ===\n');
console.log('Languages found in LANG:', SUPPORTED_LANGS.join(', '));

// Every supported language must have all required keys
for (const lang of SUPPORTED_LANGS) {
  for (const key of REQUIRED_LANG_KEYS) {
    assert(
      typeof LANG[lang][key] === 'string' && LANG[lang][key].length > 0,
      `LANG.${lang}.${key} is missing or empty`
    );
  }
}

// {name} placeholder must be present in congratsMsg for all languages
for (const lang of SUPPORTED_LANGS) {
  assert(
    LANG[lang].congratsMsg && LANG[lang].congratsMsg.includes('{name}'),
    `LANG.${lang}.congratsMsg is missing {name} placeholder`
  );
}

// ── 2. SCENARIO_TRANSLATIONS: structural completeness ─────────────────────────
const SCENARIO_IDS = ['phishing', 'device-code', 'vishing', 'insider'];

// English step counts (ground truth)
const EN_STEP_COUNTS = { phishing: 3, 'device-code': 3, vishing: 3, insider: 3 };

// English choice counts per step (ground truth)
const EN_CHOICE_COUNTS = {
  phishing:      [4, 3, 3],
  'device-code': [4, 3, 3],
  vishing:       [4, 3, 3],
  insider:       [4, 3, 3],
};

const TRANSLATED_LANGS = Object.keys(SCENARIO_TRANSLATIONS);
console.log('Languages found in SCENARIO_TRANSLATIONS:', TRANSLATED_LANGS.join(', '));

for (const lang of TRANSLATED_LANGS) {
  const langData = SCENARIO_TRANSLATIONS[lang];

  for (const scenarioId of SCENARIO_IDS) {
    const scenario = langData[scenarioId];

    assert(
      scenario !== undefined,
      `SCENARIO_TRANSLATIONS.${lang}.${scenarioId} is missing`
    );
    if (!scenario) continue;

    // Required top-level fields
    for (const field of ['title', 'desc', 'difficulty', 'badge', 'lessons', 'steps']) {
      assert(
        scenario[field] !== undefined && scenario[field] !== null,
        `SCENARIO_TRANSLATIONS.${lang}.${scenarioId}.${field} is missing`
      );
    }

    // Lessons must be a non-empty array
    assert(
      Array.isArray(scenario.lessons) && scenario.lessons.length > 0,
      `SCENARIO_TRANSLATIONS.${lang}.${scenarioId}.lessons must be a non-empty array`
    );

    // Step count must match English baseline
    assert(
      Array.isArray(scenario.steps) &&
        scenario.steps.length === EN_STEP_COUNTS[scenarioId],
      `SCENARIO_TRANSLATIONS.${lang}.${scenarioId} must have ${EN_STEP_COUNTS[scenarioId]} steps ` +
        `(found ${scenario.steps ? scenario.steps.length : 'none'})`
    );

    if (!Array.isArray(scenario.steps)) continue;

    // Per-step validation
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];

      assert(
        typeof step.narrative === 'string' && step.narrative.length > 0,
        `SCENARIO_TRANSLATIONS.${lang}.${scenarioId}.steps[${i}].narrative is missing`
      );

      // Choice count must match English baseline
      const expectedChoices = EN_CHOICE_COUNTS[scenarioId][i];
      assert(
        Array.isArray(step.choices) && step.choices.length === expectedChoices,
        `SCENARIO_TRANSLATIONS.${lang}.${scenarioId}.steps[${i}] must have ${expectedChoices} choices ` +
          `(found ${step.choices ? step.choices.length : 'none'})`
      );

      if (!Array.isArray(step.choices)) continue;

      // Each choice must have text and feedback
      for (let c = 0; c < step.choices.length; c++) {
        const choice = step.choices[c];
        assert(
          typeof choice.text === 'string' && choice.text.length > 0,
          `SCENARIO_TRANSLATIONS.${lang}.${scenarioId}.steps[${i}].choices[${c}].text is missing`
        );
        assert(
          typeof choice.feedback === 'string' && choice.feedback.length > 0,
          `SCENARIO_TRANSLATIONS.${lang}.${scenarioId}.steps[${i}].choices[${c}].feedback is missing`
        );
      }
    }
  }
}

// ── 3. Sanity: cs and sk must be present ─────────────────────────────────────
assert('cs' in LANG,                  'Czech (cs) entry missing from LANG');
assert('sk' in LANG,                  'Slovak (sk) entry missing from LANG');
assert('cs' in SCENARIO_TRANSLATIONS, 'Czech (cs) entry missing from SCENARIO_TRANSLATIONS');
assert('sk' in SCENARIO_TRANSLATIONS, 'Slovak (sk) entry missing from SCENARIO_TRANSLATIONS');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (errors.length > 0) {
  errors.forEach(e => console.log(e));
  console.log('');
}
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
