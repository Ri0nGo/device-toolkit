import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultConfig, escapeHtml, formConfig, normalizeConfig } from './config.js';

test('normalizeConfig merges partial device config with defaults', () => {
  const config = normalizeConfig({
    device_key: 'dk_001',
    sensor: { type: 'a3144', pin: 4, data_key: 'door' },
  });

  assert.equal(config.device_key, 'dk_001');
  assert.equal(config.device_role, 'standalone');
  assert.equal(config.sensor.type, 'a3144');
  assert.equal(config.sensor.pin, 4);
  assert.equal(config.sensor.data_key, 'door');
  assert.equal(config.mqtt.port, 1883);
});

test('formConfig keeps only DHT11 sensor fields for dht11 config', () => {
  const config = defaultConfig();
  config.sensor.active_level = 'low';
  config.sensor.data_key = 'door';

  const result = formConfig(config);

  assert.equal(result.sensor.type, 'dht11');
  assert.equal(result.sensor.pin, 2);
  assert.equal(result.sensor.collect_interval_ms, 5000);
  assert.deepEqual(result.sensor.data_keys, { temperature: 't', humidity: 'h', heat_index: 'p_t' });
  assert.equal('active_level' in result.sensor, false);
  assert.equal('data_key' in result.sensor, false);
});

test('formConfig keeps only A3144 sensor fields for a3144 config', () => {
  const config = normalizeConfig({
    sensor: { type: 'a3144', pin: '4', active_level: 'low', debounce_ms: '50', report_interval_ms: '60000', data_key: 'door', active_value: '1' },
  });

  const result = formConfig(config);

  assert.equal(result.sensor.type, 'a3144');
  assert.equal(result.sensor.pin, 4);
  assert.equal(result.sensor.active_value, 1);
  assert.equal('collect_interval_ms' in result.sensor, false);
  assert.equal('data_keys' in result.sensor, false);
});

test('escapeHtml escapes text inserted into templates', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
