package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const defaultBaudRate = 115200

type App struct {
	ctx    context.Context
	client DeviceClient
}

func NewApp(client DeviceClient) *App {
	return &App{client: client}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

type DeviceClient interface {
	ListPorts() ([]string, error)
	Probe(portName string, baudRate int) (*DeviceSummary, error)
	GetConfig(portName string, baudRate int) (*DeviceConfigResponse, error)
	WriteConfig(portName string, baudRate int, config map[string]any, restart bool) (*WriteConfigResponse, error)
}

type DeviceSummary struct {
	Port       string         `json:"port"`
	BaudRate   int            `json:"baudRate"`
	Configured bool           `json:"configured"`
	Model      string         `json:"model"`
	SensorType string         `json:"sensorType"`
	DeviceKey  string         `json:"deviceKey"`
	MAC        string         `json:"mac"`
	Config     map[string]any `json:"config"`
}

type DeviceConfigResponse struct {
	Port       string         `json:"port"`
	BaudRate   int            `json:"baudRate"`
	Configured bool           `json:"configured"`
	Config     map[string]any `json:"config"`
}

type WriteConfigResponse struct {
	Status     string `json:"status"`
	Cmd        string `json:"cmd"`
	Configured bool   `json:"configured"`
	Restart    bool   `json:"restart"`
}

func (a *App) ScanPorts(baudRate int) ([]DeviceSummary, error) {
	baudRate = normalizeBaudRate(baudRate)
	ports, err := a.client.ListPorts()
	if err != nil {
		return nil, err
	}

	devices := make([]DeviceSummary, 0)
	for _, portName := range ports {
		device, err := a.client.Probe(portName, baudRate)
		if err != nil || device == nil {
			continue
		}
		devices = append(devices, *device)
	}
	return devices, nil
}

func (a *App) GetConfig(portName string, baudRate int) (*DeviceConfigResponse, error) {
	portName = strings.TrimSpace(portName)
	if portName == "" {
		return nil, errors.New("port is required")
	}
	return a.client.GetConfig(portName, normalizeBaudRate(baudRate))
}

func (a *App) WriteConfig(portName string, baudRate int, config map[string]any, restart bool) (*WriteConfigResponse, error) {
	portName = strings.TrimSpace(portName)
	if portName == "" {
		return nil, errors.New("port is required")
	}
	if config == nil {
		return nil, errors.New("config is required")
	}
	return a.client.WriteConfig(portName, normalizeBaudRate(baudRate), config, restart)
}

func normalizeBaudRate(baudRate int) int {
	if baudRate <= 0 {
		return defaultBaudRate
	}
	return baudRate
}

func buildCommand(cmd string, payload map[string]any) ([]byte, error) {
	doc := map[string]any{"cmd": cmd}
	for key, value := range payload {
		doc[key] = value
	}

	data, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

func parseConfigResponse(portName string, baudRate int, line []byte) (*DeviceConfigResponse, error) {
	var raw struct {
		Status     string         `json:"status"`
		Configured bool           `json:"configured"`
		Config     map[string]any `json:"config"`
		Error      string         `json:"error"`
	}
	if err := json.Unmarshal(line, &raw); err != nil {
		return nil, err
	}
	if raw.Status != "ok" {
		if raw.Error != "" {
			return nil, errors.New(raw.Error)
		}
		return nil, fmt.Errorf("unexpected status %q", raw.Status)
	}
	if raw.Config == nil {
		return nil, errors.New("missing config")
	}
	return &DeviceConfigResponse{
		Port:       portName,
		BaudRate:   baudRate,
		Configured: raw.Configured,
		Config:     raw.Config,
	}, nil
}

func summarizeConfig(resp *DeviceConfigResponse) *DeviceSummary {
	if resp == nil {
		return nil
	}
	device := mapValue(resp.Config, "device")
	sensor := mapValue(resp.Config, "sensor")

	return &DeviceSummary{
		Port:       resp.Port,
		BaudRate:   resp.BaudRate,
		Configured: resp.Configured,
		Model:      stringValue(device, "name"),
		SensorType: stringValue(sensor, "type"),
		DeviceKey:  stringValue(resp.Config, "device_key"),
		MAC:        stringValue(device, "mac"),
		Config:     resp.Config,
	}
}

func mapValue(source map[string]any, key string) map[string]any {
	value, ok := source[key].(map[string]any)
	if ok {
		return value
	}
	return map[string]any{}
}

func stringValue(source map[string]any, key string) string {
	value, ok := source[key].(string)
	if !ok {
		return ""
	}
	return value
}

func withTimeout[T any](timeout time.Duration, run func() (T, error)) (T, error) {
	result := make(chan struct {
		value T
		err   error
	}, 1)
	go func() {
		value, err := run()
		result <- struct {
			value T
			err   error
		}{value: value, err: err}
	}()

	select {
	case item := <-result:
		return item.value, item.err
	case <-time.After(timeout):
		var zero T
		return zero, errors.New("operation timeout")
	}
}
