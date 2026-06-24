export function defaultConfig() {
  return {
    product_key: '',
    device_key: '',
    device_role: 'standalone',
    device: { name: '', version: '' },
    sensor: { type: 'dht11', pin: 2, collect_interval_ms: 5000, data_keys: { temperature: 't', humidity: 'h', heat_index: 'p_t' } },
    wifi: { ssid: '', password: '' },
    mqtt: { host: '', port: 1883, user: '', password: '' },
    espnow: { master_mac: '', fixed_channel: 0 },
  };
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeConfig(config) {
  const normalized = defaultConfig();
  const source = config || {};
  normalized.product_key = source.product_key || '';
  normalized.device_key = source.device_key || '';
  normalized.device_role = source.device_role || 'standalone';
  normalized.device = { ...normalized.device, ...(source.device || {}) };
  normalized.sensor = { ...normalized.sensor, ...(source.sensor || {}) };
  normalized.wifi = { ...normalized.wifi, ...(source.wifi || {}) };
  normalized.mqtt = { ...normalized.mqtt, ...(source.mqtt || {}) };
  normalized.espnow = { ...normalized.espnow, ...(source.espnow || {}) };
  return normalized;
}

export function formConfig(form) {
  const config = clone(form);
  if (config.sensor.type === 'a3144') {
    delete config.sensor.collect_interval_ms;
    delete config.sensor.data_keys;
    config.sensor.active_value = Number(config.sensor.active_value ?? 0);
  } else {
    delete config.sensor.active_level;
    delete config.sensor.debounce_ms;
    delete config.sensor.report_interval_ms;
    delete config.sensor.data_key;
    delete config.sensor.active_value;
  }
  config.sensor.pin = Number(config.sensor.pin || (config.sensor.type === 'a3144' ? 4 : 2));
  config.mqtt.port = Number(config.mqtt.port || 1883);
  config.espnow.fixed_channel = Number(config.espnow.fixed_channel || 0);
  return config;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
