package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"time"

	"go.bug.st/serial"
)

type SerialDeviceClient struct{}

func NewSerialDeviceClient() *SerialDeviceClient {
	return &SerialDeviceClient{}
}

func (c *SerialDeviceClient) ListPorts() ([]string, error) {
	return serial.GetPortsList()
}

func (c *SerialDeviceClient) Probe(portName string, baudRate int) (*DeviceSummary, error) {
	_, err := c.sendCommand(portName, baudRate, []byte("hello\n"))
	if err != nil {
		return nil, err
	}
	resp, err := c.GetConfig(portName, baudRate)
	if err != nil {
		return nil, err
	}
	return summarizeConfig(resp), nil
}

func (c *SerialDeviceClient) GetConfig(portName string, baudRate int) (*DeviceConfigResponse, error) {
	cmd, err := buildCommand("get_config", nil)
	if err != nil {
		return nil, err
	}
	line, err := c.sendCommand(portName, baudRate, cmd)
	if err != nil {
		return nil, err
	}
	return parseConfigResponse(portName, baudRate, line)
}

func (c *SerialDeviceClient) WriteConfig(portName string, baudRate int, config map[string]any, restart bool) (*WriteConfigResponse, error) {
	cmd, err := buildCommand("set_config", map[string]any{"config": config, "restart": restart})
	if err != nil {
		return nil, err
	}
	line, err := c.sendCommand(portName, baudRate, cmd)
	if err != nil {
		return nil, err
	}

	var resp WriteConfigResponse
	if err := json.Unmarshal(line, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "ok" {
		return nil, errors.New("write config failed")
	}
	return &resp, nil
}

func (c *SerialDeviceClient) sendCommand(portName string, baudRate int, command []byte) ([]byte, error) {
	return withTimeout(4*time.Second, func() ([]byte, error) {
		mode := &serial.Mode{BaudRate: baudRate}
		port, err := serial.Open(portName, mode)
		if err != nil {
			return nil, err
		}
		defer port.Close()

		_ = port.SetReadTimeout(1200 * time.Millisecond)
		_, err = port.Write(command)
		if err != nil {
			return nil, err
		}

		reader := bufio.NewReader(port)
		line, err := reader.ReadBytes('\n')
		if err != nil {
			return nil, err
		}
		return line, nil
	})
}
