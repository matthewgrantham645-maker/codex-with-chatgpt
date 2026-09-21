import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { advise } from './advisor.mjs';

const config = { enabled: true, apiKey: 'test-only-secret', model: 'test-model', prompt: 'Suggest a test.' };
test('disabled and missing configuration never contact provider', async () => {
  const fetchImpl = () => { assert.fail('must not call network'); };
  assert.equal((await advise({ fetchImpl })).reason, 'disabled');
  assert.equal((await advise({ enabled: true, fetchImpl })).reason, 'missing_configuration');
});
test('invalid input never contacts provider', async () => {
  const fetchImpl = () => { assert.fail('must not call network'); };
  for (const prompt of ['', ' ', 'x'.repeat(32769)])
    assert.equal((await advise({ ...config, prompt, fetchImpl })).reason, 'invalid_prompt');
  assert.equal((await advise({ ...config, timeoutMs: 0, fetchImpl })).reason, 'invalid_timeout');
});
test('successful advice retains Codex execution and requires review', async () => {
  const result = await advise({ ...config, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.messages[1].content, config.prompt);
    assert.equal(body.model, config.model);
    assert.equal(body.tools, undefined);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'Add a boundary test.' } }] }) };
  } });
  assert.equal(result.status, 'advice');
  assert.equal(result.worker, 'codex');
  assert.equal(result.requiresReview, true);
});
test('HTTP, network and JSON errors fall back without leaking errors', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => { throw new Error(config.apiKey); },
    async () => ({ ok: true, json: async () => { throw new Error(config.apiKey); } }),
  ]) {
    const result = await advise({ ...config, fetchImpl });
    assert.equal(result.status, 'fallback');
    assert.equal(JSON.stringify(result).includes(config.apiKey), false);
  }
});
test('empty, truncated and malformed responses are not accepted', async () => {
  for (const data of [{}, { choices: [] },
    { choices: [{ finish_reason: 'stop', message: { content: '' } }] },
    { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }]) {
    const result = await advise({ ...config, fetchImpl: async () => ({ ok: true, json: async () => data }) });
    assert.equal(result.reason, 'invalid_response');
  }
});
test('deadline covers both connection and response body', async () => {
  for (const fetchImpl of [() => new Promise(() => {}),
    async () => ({ ok: true, json: () => new Promise(() => {}) })]) {
    const result = await advise({ ...config, timeoutMs: 10, fetchImpl });
    assert.equal(result.reason, 'timeout');
  }
});
test('CLI is disabled by default and exits without waiting for stdin', () => {
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./advisor.mjs', import.meta.url))],
    { encoding: 'utf8', timeout: 2000, env: {} });
  assert.equal(child.status, 0);
  assert.equal(JSON.parse(child.stdout).reason, 'disabled');
});
