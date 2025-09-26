# Grafana Alloy Log Monitoring for Quanta Application

This directory contains a Grafana Alloy monitoring stack configured to collect and visualize logs from the Quanta application.

## Overview

This setup uses Grafana Alloy to collect logs from `./dist/server/logs`, forwards them to Loki for storage, and makes them available for visualization in Grafana. The configuration is based on the [Grafana Alloy scenario](https://github.com/grafana/alloy-scenarios/tree/main/logs-file).

## Configuration

### Alloy Configuration (`config.alloy`)

The Alloy agent is configured to:
- Monitor `/temp/logs/*.log` (mapped to Quanta's log directory)
- **Parse JSON logs** and extract structured metadata
- Use job label "quanta" for log identification
- Read entire log files including existing content (`tail_from_end = false`)
- Check for new files every 5 seconds
- Forward processed logs with labels to Loki

Key configuration with JSON parsing:
```alloy
local.file_match "local_files" {
    path_targets = [{"__path__" = "/temp/logs/*.log", "job" = "quanta", "hostname" = constants.hostname}]
    sync_period  = "5s"
}

loki.source.file "log_scrape" {
    targets    = local.file_match.local_files.targets
    forward_to = [loki.process.json_parser.receiver]
    tail_from_end = false
}

// Process JSON logs and extract structured metadata
loki.process "json_parser" {
    stage.json {
        expressions = {
            level     = "level",
            timestamp = "time", 
            message   = "msg",
            pid       = "pid",
            hostname  = "hostname",
        }
    }

    // Add labels for better querying
    stage.labels {
        values = {
            level    = "",
            hostname = "",
        }
    }

    // Format timestamp if needed
    stage.timestamp {
        source = "timestamp"
        format = "RFC3339"
    }

    forward_to = [loki.write.local.receiver]
}
```

### Docker Compose Setup

The stack includes three containers:
- **Alloy**: Log collection agent (port ${ALLOY_HTTP_PORT})
- **Loki**: Log storage backend (port ${LOKI_PORT})  
- **Grafana**: Visualization frontend (port ${GRAFANA_PORT})

Volume mount configuration:
```yaml
volumes:
  - ./config.alloy:/etc/alloy/config.alloy
  - /home/clay/ferguson/quanta/dist/server/logs:/temp/logs
```

**Note**: Use absolute paths for volume mounts to ensure reliable access to log files.

## Quanta Log Format

Quanta now uses **structured JSON logging** with Pino for enhanced observability:

### Structured JSON Logs
All application logs are now in JSON format with structured metadata:
```json
{
  "level": 30,
  "time": "2025-09-26T18:48:32.628Z",
  "pid": 111184,
  "hostname": "XPS-9300",
  "msg": "Plugins loaded: docs"
}
```

### HTTP Request/Response Logs
HTTP requests and responses are automatically logged with detailed information:
```json
{
  "level": 30,
  "time": "2025-09-26T18:48:32.628Z",
  "pid": 111184,
  "hostname": "XPS-9300",
  "reqId": "req-352",
  "req": {
    "method": "GET",
    "url": "/assets/main.js",
    "headers": {
      "host": "localhost:8000",
      "user-agent": "Mozilla/5.0...",
      "content-type": "application/javascript"
    },
    "remoteAddress": "::1",
    "remotePort": 38740
  },
  "res": {
    "statusCode": 200,
    "headers": {
      "content-type": "application/javascript; charset=UTF-8",
      "content-length": "1603"
    }
  },
  "responseTime": 14,
  "msg": "request completed"
}
```

### Legacy Text Format (Deprecated)
Previous plain text format (now replaced with structured JSON):
```
09-23-25 2:11:58 PM: Plugins loaded: docs
```

## Usage

### Automated Usage (Integrated with Quanta)
When `RUN_GRAFANA=true` in `/build/dev/build-and-start.sh`, Grafana Alloy will automatically start when you run:
```bash
./build/dev/build-and-start.sh
```

### Manual Usage (Independent Scripts)
For manual control of the Grafana Alloy stack, use the dedicated scripts:

**Start Grafana Alloy Stack:**
```bash
./grafana/alloy/start.sh
```
- Checks if containers are already running
- Starts only if needed (idempotent)
- Provides status feedback and URLs

**Stop Grafana Alloy Stack:**
```bash
./grafana/alloy/stop.sh
```
- Safely stops all Grafana containers
- Checks status before attempting to stop
- Provides clean shutdown feedback

**Restart Grafana Alloy Stack:**
```bash
./grafana/alloy/restart.sh
```
- Quick restart using `docker-compose restart` (recommended)
- Restarts containers in place without recreation
- Provides status feedback and URLs

```bash
./grafana/alloy/restart.sh --complete
```
- Complete restart using full stop/start cycle
- Recreates containers from scratch
- Use when you need a completely fresh start

### Original Docker Compose Method
You can also use the traditional Docker Compose commands:
```bash
cd grafana/alloy
docker-compose up -d    # Start
docker-compose down     # Stop
```

### Access Points
- **Grafana Alloy UI**: `http://localhost:${ALLOY_HTTP_PORT}`
- **Grafana UI**: `http://localhost:${GRAFANA_PORT}`

## File Structure

```
grafana/alloy/
├── README.md                   # This documentation
├── config.alloy                # Alloy agent configuration
├── docker-compose.yml          # Container orchestration
├── loki-config.yaml            # Loki storage configuration
├── main.py                     # Sample log generator (unused)
├── restart.sh                  # Restart script
├── grafana-set-env.sh          # Environment variables configuration
├── start.sh                    # Startup script
└── stop.sh                     # Shutdown script
```

## Management Scripts

### start.sh
Intelligent startup script that:
- **Automatically sets up persistent storage** directories and permissions
- Checks if containers are already running
- Starts the stack only if needed (idempotent)  
- Provides clear status feedback and access URLs
- Works from any directory
- Creates `/home/clay/ferguson/grafana-database/` structure automatically

### stop.sh
Clean shutdown script that:
- Checks container status before attempting shutdown
- Uses `docker-compose down` for proper cleanup
- Provides clear feedback on shutdown progress
- Works from any directory

### restart.sh
Flexible restart script that:
- **Default mode**: Uses `docker-compose restart` for efficient in-place restart
- **Complete mode** (`--complete` flag): Performs full stop/start cycle for clean recreation
- Automatically starts containers if not currently running
- Provides clear status feedback and access URLs
- Works from any directory

### grafana-set-env.sh
Centralized environment configuration that:
- Defines all environment variables used by the monitoring stack
- Sources consistent paths and settings across all scripts
- Allows easy customization of directories and Docker image versions
- Used automatically by `start.sh` and `restart.sh`

## Features

- **Structured JSON Logging**: All logs use Pino for consistent JSON format with rich metadata
- **HTTP Request Tracing**: Automatic logging of all HTTP requests and responses with timing
- **JSON Parsing**: Alloy extracts structured fields for advanced querying in Grafana
- **Correlation IDs**: Each HTTP request gets a unique ID for distributed tracing
- **Performance Metrics**: Response times, status codes, and request details automatically captured
- **Automatic Setup**: The `start.sh` script automatically creates and configures persistent storage
- **Automatic Log Discovery**: Monitors the Quanta logs directory for all `.log` files
- **Real-time Monitoring**: New log entries are ingested as they're written
- **Historical Data**: Existing log files are read in their entirety
- **Persistent Storage**: Logs are stored permanently and survive container restarts
- **Advanced Querying**: LogQL queries on structured JSON fields (method, status, URL, timing)
- **Web Interface**: Easy visualization and searching through Grafana
- **Scalable**: Handles multiple log files and growing log volumes

## Viewing Logs in Grafana

1. **Access Grafana**: Go to `http://localhost:${GRAFANA_PORT}`
2. **Navigate to Explore**: Click the compass icon (🧭) in the left sidebar
3. **Select Loki Data Source**: Ensure "Loki" is selected in the dropdown
4. **Query Your Logs**: Use these LogQL queries for different insights:

### Basic Queries
```logql
{job="quanta"}                          # All Quanta logs
{job="quanta"} | json                   # Parse JSON structure
{job="quanta", level="error"}           # Error logs only
{job="quanta"} | json | level="warn"    # Warning logs
```

### HTTP Request Analysis
```logql
# All HTTP requests
{job="quanta"} | json | has("req")

# Error responses (4xx/5xx)
{job="quanta"} | json | res_statusCode >= 400

# Slow requests (response time > 100ms)
{job="quanta"} | json | responseTime > 100

# Specific endpoints
{job="quanta"} | json | req_method="POST"
{job="quanta"} | json | req_url =~ "/api/.*"

# Requests by status code
{job="quanta"} | json | res_statusCode="200"
```

### Advanced Filtering
```logql
# Combine multiple conditions
{job="quanta"} | json | req_method="GET" | res_statusCode >= 400

# Search in message content
{job="quanta"} |= "error" | json

# Exclude certain paths
{job="quanta"} | json | req_url !~ "/assets/.*"
```

5. **Adjust Time Range**: If needed, expand to "Last 24 hours" or "Last 7 days"

