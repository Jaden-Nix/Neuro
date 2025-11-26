# NeuroNet Governor - API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Currently no authentication required for development. Production will use wallet-based auth.

## Endpoints

### System State

#### GET /api/system/state
Get current system state and configuration.

**Response**:
```json
{
  "autonomousMode": boolean,
  "activeAgents": string[],
  "totalSimulationsRun": number,
  "totalTransactionsExecuted": number,
  "systemHealth": number,
  "lastUpdated": number
}
```

### Agents

#### GET /api/agents
List all active agents.

**Response**:
```json
[
  {
    "id": "string",
    "type": "meta" | "scout" | "risk" | "execution",
    "status": "idle" | "active" | "negotiating" | "executing" | "deprecated",
    "personality": ["curious", "energetic"],
    "creditScore": number,
    "version": number,
    "spawnedAt": number,
    "currentTask": "string"
  }
]
```

#### GET /api/agents/:id
Get specific agent details.

**Parameters**:
- `id` (string): Agent ID

**Response**: Single agent object

### Metrics

#### GET /api/metrics
Get live system metrics.

**Response**:
```json
{
  "walletBalance": "string",
  "totalTVL": "string",
  "currentAPY": number,
  "riskLevel": number,
  "activeOpportunities": number,
  "pendingTransactions": number,
  "timestamp": number
}
```

### Logs

#### GET /api/logs
Get recent log entries.

**Query Parameters**:
- `limit` (number, optional): Max logs to return (default: 100)
- `agentType` (string, optional): Filter by agent type
- `level` (string, optional): Filter by log level

**Response**:
```json
[
  {
    "id": "string",
    "timestamp": number,
    "agentType": "meta" | "scout" | "risk" | "execution",
    "level": "info" | "warn" | "error" | "success",
    "message": "string",
    "personality": "string"
  }
]
```

### Credit Economy

#### GET /api/credits
Get agent credit scores.

**Response**:
```json
[
  {
    "agentId": "string",
    "agentType": "scout",
    "totalCredits": number,
    "accuracyRate": number,
    "successfulActions": number,
    "failedActions": number
  }
]
```

#### GET /api/credits/transactions
Get credit transaction history.

**Response**:
```json
[
  {
    "agentId": "string",
    "agentType": "scout",
    "amount": number,
    "reason": "string",
    "timestamp": number
  }
]
```

### Memory Vault

#### GET /api/memory
Get memory vault entries.

**Query Parameters**:
- `strategyType` (string, optional): Filter by type
- `limit` (number, optional): Max entries

**Response**:
```json
[
  {
    "id": "string",
    "strategyType": "successful" | "blocked" | "high-risk" | "learned",
    "description": "string",
    "agentScores": {},
    "riskPattern": "string",
    "simulationSummary": "string",
    "timestamp": number,
    "tags": ["string"]
  }
]
```

#### POST /api/memory
Store new memory entry.

**Body**:
```json
{
  "strategyType": "successful",
  "description": "string",
  "agentScores": {},
  "riskPattern": "string",
  "simulationSummary": "string",
  "tags": ["string"]
}
```

### Simulations

#### GET /api/simulations
Get simulation tree data.

**Response**:
```json
[
  {
    "id": "string",
    "parentId": "string | null",
    "predictions": [
      {
        "timestamp": number,
        "price": number,
        "volatility": number,
        "tvl": number,
        "yield": number,
        "pegDeviationFRAX": number,
        "pegDeviationKRWQ": number,
        "ev": number
      }
    ],
    "outcome": "success" | "failure" | "pending",
    "evScore": number
  }
]
```

#### POST /api/simulate
Run new simulation.

**Body**:
```json
{
  "scenario": "string",
  "timeHorizon": number,
  "parameters": {}
}
```

**Response**:
```json
{
  "simulationId": "string",
  "status": "running",
  "estimatedTime": number
}
```

### Replay Engine

#### GET /api/replay/events
Get timeline events.

**Query Parameters**:
- `startTime` (number, optional): Start timestamp
- `endTime` (number, optional): End timestamp
- `eventType` (string, optional): Filter by type

**Response**:
```json
[
  {
    "id": "string",
    "eventType": "decision" | "simulation" | "negotiation" | "execution" | "alert",
    "agentType": "scout",
    "data": {},
    "timestamp": number
  }
]
```

### Control

#### POST /api/autonomous/toggle
Toggle autonomous mode.

**Response**:
```json
{
  "autonomousMode": boolean,
  "message": "string"
}
```

#### POST /api/execute
Manual execution override.

**Body**:
```json
{
  "action": "swap" | "rebalance" | "loan" | "stake",
  "parameters": {}
}
```

**Response**:
```json
{
  "transactionId": "string",
  "status": "pending",
  "hash": "string"
}
```

### Alerts

#### GET /api/alerts
Get sentinel alerts.

**Query Parameters**:
- `severity` (string, optional): Filter by severity
- `active` (boolean, optional): Only active alerts

**Response**:
```json
[
  {
    "id": "string",
    "alertType": "wallet_health" | "liquidity_change" | "peg_deviation" | "volatility_spike" | "oracle_anomaly" | "pool_drain" | "liquidation_risk",
    "severity": "low" | "medium" | "high" | "critical",
    "message": "string",
    "data": {},
    "timestamp": number,
    "autoExecuted": boolean
  }
]
```

## WebSocket Events

Connect to: `ws://localhost:5000/ws`

### Event Types

#### log
```json
{
  "type": "log",
  "data": {
    "id": "string",
    "timestamp": number,
    "agentType": "scout",
    "level": "info",
    "message": "string"
  },
  "timestamp": number
}
```

#### metrics
```json
{
  "type": "metrics",
  "data": {
    "walletBalance": "string",
    "totalTVL": "string",
    ...
  },
  "timestamp": number
}
```

#### alert
```json
{
  "type": "alert",
  "data": {
    "alertType": "volatility_spike",
    "severity": "high",
    "message": "string"
  },
  "timestamp": number
}
```

#### simulation
```json
{
  "type": "simulation",
  "data": {
    "simulationId": "string",
    "status": "completed",
    "results": {}
  },
  "timestamp": number
}
```

#### agent_update
```json
{
  "type": "agent_update",
  "data": {
    "agentId": "string",
    "status": "active",
    "currentTask": "string"
  },
  "timestamp": number
}
```

#### transaction
```json
{
  "type": "transaction",
  "data": {
    "hash": "string",
    "status": "confirmed",
    "value": "string"
  },
  "timestamp": number
}
```

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "string",
  "message": "string",
  "code": "ERROR_CODE"
}
```

### Error Codes
- `AGENT_NOT_FOUND`: Agent doesn't exist
- `SIMULATION_FAILED`: Simulation error
- `INVALID_PARAMETERS`: Bad request data
- `INSUFFICIENT_BALANCE`: Not enough funds
- `TRANSACTION_FAILED`: On-chain error
- `RATE_LIMIT_EXCEEDED`: Too many requests
