import './styles.css';
import { defaultConfig, escapeHtml, formConfig as buildFormConfig, normalizeConfig } from './config.js';

const state = {
  baudRate: 115200,
  devices: [],
  selectedPort: '',
  selectedDevice: null,
  currentTab: 'identity',
  form: defaultConfig(),
  busy: false,
  status: '就绪',
  confirmOpen: false,
  aboutOpen: false,
};

const api = {
  scanPorts: (baudRate) => window.go?.main?.App?.ScanPorts?.(baudRate) ?? Promise.reject(new Error('Wails runtime is not available')),
  getConfig: (port, baudRate) => window.go?.main?.App?.GetConfig?.(port, baudRate) ?? Promise.reject(new Error('Wails runtime is not available')),
  writeConfig: (port, baudRate, config, restart) => window.go?.main?.App?.WriteConfig?.(port, baudRate, config, restart) ?? Promise.reject(new Error('Wails runtime is not available')),
};

function formConfig() {
  return buildFormConfig(state.form);
}

function setStatus(text) {
  state.status = text;
  render();
}

function setBusy(busy) {
  state.busy = busy;
  render();
}

function selectDevice(device) {
  state.selectedDevice = device;
  state.selectedPort = device?.port || '';
  state.form = device?.config ? normalizeConfig(device.config) : defaultConfig();
}

async function scanPorts() {
  setBusy(true);
  try {
    const devices = await api.scanPorts(state.baudRate);
    state.devices = devices || [];
    selectDevice(state.devices[0] || null);
    setStatus(`扫描完成，发现 ${state.devices.length} 台设备。`);
  } catch (error) {
    setStatus(`扫描失败: ${error.message || error}`);
  } finally {
    setBusy(false);
  }
}

async function readConfig() {
  if (!state.selectedPort) return setStatus('请选择设备。');
  setBusy(true);
  try {
    const response = await api.getConfig(state.selectedPort, state.baudRate);
    const device = { ...state.selectedDevice, ...response, config: response.config };
    state.devices = state.devices.map((item) => (item.port === device.port ? device : item));
    selectDevice(device);
    setStatus(`${state.selectedPort}: 已读取当前配置。`);
  } catch (error) {
    setStatus(`读取失败: ${error.message || error}`);
  } finally {
    setBusy(false);
  }
}

async function writeConfig() {
  if (!state.selectedPort) return setStatus('请选择设备。');
  setBusy(true);
  try {
    await api.writeConfig(state.selectedPort, state.baudRate, formConfig(), true);
    state.confirmOpen = false;
    setStatus('配置已写入，设备将重启。');
  } catch (error) {
    setStatus(`写入失败: ${error.message || error}`);
  } finally {
    setBusy(false);
  }
}

function update(path, value) {
  const keys = path.split('.');
  let target = state.form;
  while (keys.length > 1) target = target[keys.shift()];
  target[keys[0]] = value;
  if (path === 'sensor.type') {
    state.form.sensor.pin = value === 'a3144' ? 4 : 2;
  }
  render();
}

function input(path, label, attrs = {}) {
  const value = path.split('.').reduce((obj, key) => obj?.[key], state.form) ?? '';
  const type = attrs.type || 'text';
  return `<div class="field ${attrs.full ? 'full' : ''}"><label>${escapeHtml(label)}${attrs.hint ? `<small>${escapeHtml(attrs.hint)}</small>` : ''}</label><input class="input" ${state.selectedPort ? '' : 'disabled'} type="${escapeHtml(type)}" value="${escapeHtml(value)}" data-bind="${escapeHtml(path)}"></div>`;
}

function select(path, label, options, hint = '') {
  const value = path.split('.').reduce((obj, key) => obj?.[key], state.form) ?? '';
  return `<div class="field"><label>${escapeHtml(label)}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</label><select class="select" ${state.selectedPort ? '' : 'disabled'} data-bind="${escapeHtml(path)}">${options.map((item) => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(value) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></div>`;
}

function render() {
  document.querySelector('#app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark"></div><div><strong>IOT Studio</strong><span>ESP32-C3 配置工具</span></div><button class="icon-button" data-action="about">•••</button></div>
        <div class="nav-section"><button class="control primary" data-action="scan" ${state.busy ? 'disabled' : ''}>扫描串口</button><div class="device-list">${renderDevices()}</div></div>
        <div class="sidebar-footer"><div class="mini-status"><div>已发现: <strong>${state.devices.length}</strong></div><div class="baud-setting"><label>串口波特率<small>JSON Lines</small></label><select class="baud-select" data-action="baud"><option value="9600">9600</option><option value="57600">57600</option><option value="115200" ${state.baudRate === 115200 ? 'selected' : ''}>115200</option><option value="921600">921600</option></select></div></div></div>
      </aside>
      <section class="main"><main class="content"><div class="dashboard"><section class="card config-card"><div class="card-head"><div><h2>设备配置</h2><p>所有变更会先预览，再通过 set_config 写入 NVS。</p></div><button class="control" data-action="read" ${!state.selectedPort || state.busy ? 'disabled' : ''}>读取当前</button></div><div class="card-body config-body"><form id="configForm"><div class="form-section"><div class="config-tabs">${renderTabs()}</div>${renderPanel()}</div><div class="form-actions"><button class="control" type="button" data-action="restore" ${!state.selectedPort ? 'disabled' : ''}>恢复</button><button class="control primary" type="submit" ${!state.selectedPort ? 'disabled' : ''}>预览并确认</button></div></form></div></section><aside class="stack side-stack"><section class="card"><div class="card-head"><div><h2>硬件信息</h2><p>由 get_config 返回。</p></div></div><div class="card-body"><div class="info-grid">${renderHardware()}</div></div></section></aside></div></main><footer class="statusbar"><span>${escapeHtml(state.status)}</span></footer></section>
    </div>${state.confirmOpen ? renderConfirm() : ''}${state.aboutOpen ? renderAbout() : ''}`;
}

function renderDevices() {
  if (!state.devices.length) return '<div class="empty">未发现设备。</div>';
  return state.devices.map((device) => `<article class="device-card ${state.selectedPort === device.port ? 'active' : ''}" data-port="${escapeHtml(device.port)}"><div class="device-head"><span class="port">${escapeHtml(device.port)}</span><span class="badge ${device.configured ? '' : 'warn'}">${device.configured ? '已配置' : '待配置'}</span></div><div class="device-meta"><span>${escapeHtml(device.model || '-')} · ${escapeHtml(device.sensorType || '-')}</span><span>${escapeHtml(device.mac || '-')}</span><span>${escapeHtml(device.deviceKey || '-')}</span></div></article>`).join('');
}

function renderTabs() {
  return [['identity', '基础信息'], ['sensor', '传感器'], ['network', '网络'], ['espnow', 'ESP-NOW']].map(([key, label]) => `<button class="tab-button ${state.currentTab === key ? 'active' : ''}" type="button" data-tab="${key}">${label}</button>`).join('');
}

function renderPanel() {
  const roleHint = state.form.device_role === 'standalone' ? '<strong>standalone</strong> 会连接 Wi-Fi 和 MQTT，必填 Wi-Fi SSID、MQTT Host、MQTT Port。' : '<strong>espnow_slave</strong> 不连接业务 Wi-Fi/MQTT，必填主节点 MAC，固定信道可填 0 表示自动探测。';
  const networkHint = state.form.device_role === 'standalone' ? '<strong>当前角色需要网络配置。</strong> Topic 由 product_key 与 device_key 自动拼接。' : '<strong>当前角色不会使用 Wi-Fi/MQTT。</strong> 可保留字段为空，数据会通过 ESP-NOW 发往主节点。';
  const common = {
    identity: `${input('product_key', 'Product Key', { hint: '必填' })}${input('device_key', 'Device Key', { hint: '必填' })}${input('device.name', '设备名称', { hint: 'device.name' })}${input('device.version', '硬件版本', { hint: 'device.version' })}${select('device_role', '运行角色', [{ value: 'standalone', label: 'standalone / 独立上传' }, { value: 'espnow_slave', label: 'espnow_slave / ESP-NOW 从节点' }], '决定必填项')}${select('sensor.type', '传感器类型', [{ value: 'dht11', label: 'dht11 / 温湿度' }, { value: 'a3144', label: 'a3144 / 门磁' }], '固件固定返回')}${input('sensor.pin', 'GPIO 引脚', { type: 'number', hint: 'DHT11 默认 2，A3144 默认 4' })}<div class="note full">${roleHint}</div>`,
    sensor: state.form.sensor.type === 'a3144' ? `${select('sensor.active_level', '有效电平', [{ value: 'low', label: 'low' }, { value: 'high', label: 'high' }], '检测到磁铁')}${input('sensor.debounce_ms', '去抖时间', { type: 'number', hint: 'ms' })}${input('sensor.report_interval_ms', '补报间隔', { type: 'number', hint: 'ms，0 表示关闭' })}${input('sensor.data_key', '业务字段', { hint: '默认 door' })}${select('sensor.active_value', '有效值', [{ value: 0, label: '0' }, { value: 1, label: '1' }], '检测到磁铁时上传')}` : `${input('sensor.collect_interval_ms', '采集间隔', { type: 'number', hint: 'ms' })}${input('sensor.data_keys.temperature', '温度字段', { hint: '默认 t' })}${input('sensor.data_keys.humidity', '湿度字段', { hint: '默认 h' })}${input('sensor.data_keys.heat_index', '体感温度字段', { hint: '默认 p_t' })}`,
    network: `<div class="note full">${networkHint}</div>${input('wifi.ssid', 'Wi-Fi SSID', { hint: 'standalone 必填' })}${input('wifi.password', 'Wi-Fi 密码', { type: 'password' })}${input('mqtt.host', 'MQTT Host', { hint: 'standalone 必填' })}${input('mqtt.port', 'MQTT Port', { type: 'number', hint: 'standalone 必填' })}${input('mqtt.user', 'MQTT 用户名')}${input('mqtt.password', 'MQTT 密码', { type: 'password' })}`,
    espnow: `<div class="note full">当角色为 <strong>espnow_slave</strong> 时，设备不会连接业务 Wi-Fi 或 MQTT，只通过 ESP-NOW 把采集数据发送给主节点。</div>${input('espnow.master_mac', '主节点 MAC', { hint: 'espnow_slave 必填' })}${input('espnow.fixed_channel', '固定信道', { type: 'number', hint: '1-13，0 自动探测' })}`,
  };
  return `<section class="tab-panel active"><div class="section-title">${{ identity: '基础信息', sensor: '传感器参数', network: 'Wi-Fi 与 MQTT', espnow: 'ESP-NOW 从节点' }[state.currentTab]}</div><div class="form-grid">${common[state.currentTab]}</div></section>`;
}

function renderHardware() {
  if (!state.selectedDevice) return '<div class="empty">请选择设备。</div>';
  const config = state.selectedDevice.config || {};
  const device = config.device || {};
  const rows = [['串口', state.selectedDevice.port], ['波特率', state.selectedDevice.baudRate], ['Model', state.selectedDevice.model || device.name || '-'], ['Chip', device.chip || '-'], ['MAC', device.mac || state.selectedDevice.mac || '-'], ['Flash', device.flash ? `${Math.round(device.flash / 1024 / 1024)} MB` : '-'], ['角色', config.device_role || '-'], ['状态', state.selectedDevice.configured ? '已配置' : '待配置']];
  return rows.map(([key, value]) => `<div class="info-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function renderConfirm() {
  return `<div class="modal-backdrop show"><div class="modal"><div class="modal-head"><h2>配置预览</h2><p>以下 JSON 是将通过 set_config 写入设备 NVS 的完整配置。</p></div><div class="diff-list"><pre class="code">${escapeHtml(JSON.stringify(formConfig(), null, 2))}</pre></div><div class="modal-actions"><button class="control" data-action="cancel-confirm">取消</button><button class="control danger" data-action="write" ${state.busy ? 'disabled' : ''}>写入并重启</button></div></div></div>`;
}

function renderAbout() {
  return `<div class="modal-backdrop show"><div class="about-dialog"><aside class="about-side"><div><div class="about-logo"></div><h2>IOT Studio</h2><p>ESP32-C3 传感器配置工具</p></div><div class="version-card"><span>当前软件版本</span><strong>v0.2.0</strong><span>Wails Desktop</span></div></aside><section class="about-main"><div class="about-head"><div><h3>关于软件</h3><p>用于扫描串口设备、读取配置并写入 TH-Collector 或 A3144 配置。</p></div><button class="about-close" data-action="about-close">×</button></div><div class="about-content"><div class="about-row"><span>应用名称</span><strong>IOT Studio</strong></div><div class="about-row"><span>串口协议</span><strong>JSON Lines / 可设置波特率</strong></div><div class="about-row"><span>配置存储</span><strong>ESP32 NVS</strong></div></div></section></div></div>`;
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'scan') scanPorts();
  if (action === 'read') readConfig();
  if (action === 'restore' && state.selectedDevice) { state.form = normalizeConfig(state.selectedDevice.config); render(); }
  if (action === 'about') { state.aboutOpen = true; render(); }
  if (action === 'about-close') { state.aboutOpen = false; render(); }
  if (action === 'cancel-confirm') { state.confirmOpen = false; render(); }
  if (action === 'write') writeConfig();
  const tab = event.target.closest('[data-tab]')?.dataset.tab;
  if (tab) { state.currentTab = tab; render(); }
  const port = event.target.closest('[data-port]')?.dataset.port;
  if (port) { selectDevice(state.devices.find((device) => device.port === port)); setStatus(`已选择: ${port}`); }
});

document.addEventListener('input', (event) => {
  const bind = event.target.dataset.bind;
  if (bind) update(bind, event.target.value);
});

document.addEventListener('change', (event) => {
  if (event.target.dataset.action === 'baud') {
    state.baudRate = Number(event.target.value);
    state.devices = [];
    selectDevice(null);
    setStatus(`波特率已设置为 ${state.baudRate}，请重新扫描。`);
  }
  const bind = event.target.dataset.bind;
  if (bind) update(bind, event.target.value);
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'configForm') {
    event.preventDefault();
    if (!state.selectedPort) return setStatus('请选择设备。');
    state.confirmOpen = true;
    render();
  }
});

render();
