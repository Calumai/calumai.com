const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const generator = require('../class/lesson-04-code-generator.js');

const rawId = '1AbC_def-GhijKLMNopQRstuVwxyz012345';
const template = `var folderId = '${generator.FOLDER_ID_TOKEN}';`;

assert.deepEqual(generator.parseFolderId(rawId), { id: rawId, error: '' });
assert.equal(
  generator.parseFolderId(`  ${rawId}  `).id,
  rawId,
  'raw IDs should be trimmed'
);
assert.equal(
  generator.parseFolderId(`https://drive.google.com/drive/folders/${rawId}?usp=sharing`).id,
  rawId,
  'standard Drive folder URLs should be accepted'
);
assert.equal(
  generator.parseFolderId(`https://drive.google.com/drive/u/0/folders/${rawId}/`).id,
  rawId,
  'account-scoped Drive folder URLs should be accepted'
);
assert.equal(
  generator.parseFolderId(`https://drive.google.com/drive/mobile/folders/${rawId}#files`).id,
  rawId,
  'mobile Drive folder URLs should be accepted'
);

for (const invalidValue of [
  '',
  'short',
  'https://drive.google.com/file/d/' + rawId + '/view',
  'http://drive.google.com/drive/folders/' + rawId,
  'https://drive.google.com.evil.example/drive/folders/' + rawId,
  "abc'; Logger.log('injected'); //"
]) {
  assert.notEqual(generator.parseFolderId(invalidValue).error, '', `${invalidValue} should be rejected`);
}

const completed = generator.buildCode(template, rawId);
assert.equal(completed, `var folderId = '${rawId}';`);
assert.equal(completed.includes(generator.FOLDER_ID_TOKEN), false);

assert.throws(() => generator.buildCode('var folderId = "missing";', rawId));
assert.throws(() => generator.buildCode(template + template, rawId));
assert.throws(() => generator.buildCode(template, "abc'; alert(1); //"));

const projectRoot = path.resolve(__dirname, '..');
const codeTemplate = fs.readFileSync(path.join(projectRoot, 'class/examples/lesson-04-code.gs'), 'utf8');
const lessonSource = fs.readFileSync(path.join(projectRoot, 'class/lesson.js'), 'utf8');
const actualCompletedCode = generator.buildCode(codeTemplate, rawId);

assert.equal(codeTemplate.split(generator.FOLDER_ID_TOKEN).length - 1, 1);
assert.equal(actualCompletedCode.includes(`var AUDIO_FOLDER_ID = '${rawId}';`), true);
assert.equal(actualCompletedCode.includes(generator.FOLDER_ID_TOKEN), false);
assert.equal(codeTemplate.includes('1KDxjlAh3EVbC9FCAIONfZIrAu14vPnH9'), false);
assert.equal(lessonSource.includes('requiresFolderId:true'), true);
assert.equal(lessonSource.includes('1tEVLoizcuAPDn1TVe9vWSMybxp5VCvTDs0HL-dk_hnE/copy'), true);
assert.equal(/localStorage|sessionStorage|document\.cookie/.test(lessonSource), false);

console.log('Lesson 04 Code.gs generator tests passed.');
