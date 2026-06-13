# ESP32-C3 ESP-NOW 主从节点工作流

## 整体架构图

```mermaid
flowchart LR
    A[ESP32-C3 从节点<br/>传感器节点] -->|ESP-NOW 数据包| B[ESP32-C3 主节点<br/>网关]
    B -->|ACK 确认包| A
    B -->|Wi-Fi| C[路由器]
    C --> D[MQTT / HTTP / Home Assistant / 云平台]
```

## 从节点工作流

```mermaid
flowchart TD
    A[上电启动] --> B[读取保存的网关信道]
    B --> C[初始化 Wi-Fi STA 模式]
    C --> D[初始化 ESP-NOW]
    D --> E[添加网关 MAC 地址]
    E --> F[采集传感器数据]
    F --> G[发送 DATA 数据包]
    G --> H{是否收到网关 ACK?}

    H -->|是| I[通信正常]
    I --> J[等待下一次采集]
    J --> F

    H -->|否| K[失败次数 +1]
    K --> L{连续失败超过阈值?}

    L -->|否| J
    L -->|是| M[进入扫信道模式]

    M --> N[切换到信道 1~13]
    N --> O[发送 DISCOVERY 探测包]
    O --> P{收到 DISCOVERY_ACK?}

    P -->|否| Q[尝试下一个信道]
    Q --> N

    P -->|是| R[保存当前信道]
    R --> S[恢复正常通信]
    S --> F
```

## 网关工作流

```mermaid
flowchart TD
    A[上电启动] --> B[初始化 Wi-Fi STA 模式]
    B --> C[连接路由器 Wi-Fi]
    C --> D{Wi-Fi 是否连接成功?}

    D -->|否| C
    D -->|是| E[读取当前 Wi-Fi 信道]
    E --> F[初始化 ESP-NOW]
    F --> G[注册接收回调]
    G --> H[等待 ESP-NOW 数据]

    H --> I{收到数据包类型}

    I -->|DISCOVERY| J[回复 DISCOVERY_ACK]
    J --> H

    I -->|DATA| K[解析传感器数据]
    K --> L[回复 DATA_ACK]
    L --> M[上传 MQTT / HTTP]
    M --> H

    I -->|其他| N[丢弃或记录异常]
    N --> H
```

## 通信时序图

```mermaid
sequenceDiagram
    participant Node as 从节点 ESP32-C3
    participant Gateway as 网关 ESP32-C3
    participant Router as 路由器
    participant Server as MQTT/HTTP服务器

    Gateway->>Router: 连接 Wi-Fi
    Router-->>Gateway: 分配 IP / 确定信道

    Node->>Gateway: DISCOVERY 探测包
    Gateway-->>Node: DISCOVERY_ACK

    Node->>Gateway: DATA 数据包 seq=1
    Gateway-->>Node: DATA_ACK seq=1

    Gateway->>Server: 上传数据
    Server-->>Gateway: 上传成功

    Node->>Gateway: DATA 数据包 seq=2
    Gateway-->>Node: DATA_ACK seq=2
```

## 状态机图

```mermaid
stateDiagram-v2
    [*] --> INIT

    INIT --> NORMAL: 初始化完成
    NORMAL --> NORMAL: 发送成功并收到 ACK
    NORMAL --> RETRY: 未收到 ACK
    RETRY --> NORMAL: 重发成功
    RETRY --> SCAN_CHANNEL: 连续失败

    SCAN_CHANNEL --> NORMAL: 找到网关信道
    SCAN_CHANNEL --> SCAN_CHANNEL: 继续扫描 1~13 信道

    NORMAL --> [*]: 休眠或断电
```

## 核心逻辑

从节点：采集数据 -> 发送给网关 -> 等待 ACK -> 失败则重发 -> 多次失败则扫信道。

网关：连接 Wi-Fi -> 初始化 ESP-NOW -> 接收数据 -> 回复 ACK -> 上传服务器。

这个设计适合 Wi-Fi 重启、路由器信道变化、墙体干扰等场景，比单向发送更稳定。
