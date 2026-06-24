package main

import (
	"encoding/json"
	"testing"
)

func TestBuildCommandIncludesNewline(t *testing.T) {
	cmd, err := buildCommand("set_config", map[string]any{"restart": false})
	if err != nil {
		t.Fatal(err)
	}
	if cmd[len(cmd)-1] != '\n' {
		t.Fatalf("expected newline terminator, got %q", cmd)
	}

	var decoded map[string]any
	if err := json.Unmarshal(cmd[:len(cmd)-1], &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["cmd"] != "set_config" {
		t.Fatalf("unexpected cmd: %#v", decoded["cmd"])
	}
	if decoded["restart"] != false {
		t.Fatalf("unexpected restart: %#v", decoded["restart"])
	}
}

func TestParseConfigResponseAndSummary(t *testing.T) {
	line := []byte(`{"status":"ok","configured":true,"config":{"device_key":"dk_001","device":{"name":"ESP32-C3 TH Collector","mac":"AA:BB"},"sensor":{"type":"dht11"}}}`)
	resp, err := parseConfigResponse("COM5", 115200, line)
	if err != nil {
		t.Fatal(err)
	}
	summary := summarizeConfig(resp)
	if summary.Port != "COM5" || summary.BaudRate != 115200 {
		t.Fatalf("unexpected port summary: %#v", summary)
	}
	if summary.Model != "ESP32-C3 TH Collector" {
		t.Fatalf("unexpected model: %q", summary.Model)
	}
	if summary.SensorType != "dht11" {
		t.Fatalf("unexpected sensor type: %q", summary.SensorType)
	}
	if summary.DeviceKey != "dk_001" || summary.MAC != "AA:BB" {
		t.Fatalf("unexpected identity: %#v", summary)
	}
}

func TestScanPortsSkipsProbeErrors(t *testing.T) {
	client := &fakeDeviceClient{
		ports: []string{"COM1", "COM2"},
		devices: map[string]*DeviceSummary{
			"COM2": {Port: "COM2", BaudRate: 115200, DeviceKey: "dk_002"},
		},
	}
	app := NewApp(client)
	devices, err := app.ScanPorts(0)
	if err != nil {
		t.Fatal(err)
	}
	if len(devices) != 1 {
		t.Fatalf("expected 1 device, got %d", len(devices))
	}
	if devices[0].Port != "COM2" || devices[0].BaudRate != 115200 {
		t.Fatalf("unexpected device: %#v", devices[0])
	}
}

type fakeDeviceClient struct {
	ports   []string
	devices map[string]*DeviceSummary
}

func (f *fakeDeviceClient) ListPorts() ([]string, error) {
	return f.ports, nil
}

func (f *fakeDeviceClient) Probe(portName string, baudRate int) (*DeviceSummary, error) {
	device := f.devices[portName]
	if device == nil {
		return nil, errFakeProbe
	}
	device.BaudRate = baudRate
	return device, nil
}

func (f *fakeDeviceClient) GetConfig(portName string, baudRate int) (*DeviceConfigResponse, error) {
	return nil, nil
}

func (f *fakeDeviceClient) WriteConfig(portName string, baudRate int, config map[string]any, restart bool) (*WriteConfigResponse, error) {
	return nil, nil
}

var errFakeProbe = &fakeError{}

type fakeError struct{}

func (e *fakeError) Error() string { return "probe failed" }
