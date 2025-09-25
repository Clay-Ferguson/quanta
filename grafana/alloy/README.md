# Grafana Alloy Log Monitoring for Quanta Application

This directory contains a Grafana Alloy monitoring stack configured to collect and visualize logs from the Quanta application.

## Overview

This setup uses Grafana Alloy to collect logs from `./dist/server/logs`, forwards them to Loki for storage, and makes them available for visualization in Grafana. The configuration is based on the [Grafana Alloy scenario](https://github.com/grafana/alloy-scenarios/tree/main/logs-file).

## Configuration

### Alloy Configuration (`config.alloy`)

The Alloy agent is configured to:
- Monitor `/temp/logs/*.log` (mapped to Quanta's log directory)
- Use job label "quanta" for log identification
- Read entire log files including existing content (`tail_from_end = false`)
- Check for new files every 5 seconds
- Forward all logs to Loki

Key configuration:
```alloy
local.file_match "local_files" {
    path_targets = [{"__path__" = "/temp/logs/*.log", "job" = "quanta", "hostname" = constants.hostname}]
    sync_period  = "5s"
}

loki.source.file "log_scrape" {
    targets    = local.file_match.local_files.targets
    forward_to = [loki.write.local.receiver]
    tail_from_end = false
}
```

### Docker Compose Setup

The stack includes three containers:
- **Alloy**: Log collection agent (port 12345)
- **Loki**: Log storage backend (port 3100)  
- **Grafana**: Visualization frontend (port 3000)

Volume mount configuration:
```yaml
volumes:
  - ./config.alloy:/etc/alloy/config.alloy
  - /home/clay/ferguson/quanta/dist/server/logs:/temp/logs
```

**Note**: Use absolute paths for volume mounts to ensure reliable access to log files.

## Quanta Log Format

Quanta generates logs in this format:
```
09-23-25 2:11:58 PM: Plugins loaded: docs
09-23-25 2:11:58 PM: Initializing plugins (new)...
09-23-25 2:11:58 PM: plugin: docs
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
- **Grafana Alloy UI**: `http://localhost:12345`
- **Grafana UI**: `http://localhost:3000`

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

- **Automatic Setup**: The `start.sh` script automatically creates and configures persistent storage
- **Automatic Log Discovery**: Monitors the Quanta logs directory for all `.log` files
- **Real-time Monitoring**: New log entries are ingested as they're written
- **Historical Data**: Existing log files are read in their entirety
- **Persistent Storage**: Logs are stored permanently and survive container restarts
- **Web Interface**: Easy visualization and searching through Grafana
- **Scalable**: Handles multiple log files and growing log volumes

## Viewing Logs in Grafana

1. **Access Grafana**: Go to `http://localhost:3000`
2. **Navigate to Explore**: Click the compass icon (🧭) in the left sidebar
3. **Select Loki Data Source**: Ensure "Loki" is selected in the dropdown
4. **Query Your Logs**: Use `{job="quanta"}` to see all Quanta logs
5. **Adjust Time Range**: If needed, expand to "Last 24 hours" or "Last 7 days"

