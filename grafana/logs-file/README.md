# Grafana Alloy Log Monitoring for Quanta Application

This directory contains a Grafana Alloy monitoring stack configured to collect and visualize logs from the Quanta application.

## Overview

This setup uses Grafana Alloy to collect logs from `./dist/server/logs`, forwards them to Loki for storage, and makes them available for visualization in Grafana. The configuration is based on the [Grafana Alloy logs-file scenario](https://github.com/grafana/alloy-scenarios/tree/main/logs-file).

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
./grafana/logs-file/start.sh
```
- Checks if containers are already running
- Starts only if needed (idempotent)
- Provides status feedback and URLs

**Stop Grafana Alloy Stack:**
```bash
./grafana/logs-file/stop.sh
```
- Safely stops all Grafana containers
- Checks status before attempting to stop
- Provides clean shutdown feedback

### Original Docker Compose Method
You can also use the traditional Docker Compose commands:
```bash
cd grafana/logs-file
docker-compose up -d    # Start
docker-compose down     # Stop
```

### Access Points
- **Grafana Alloy UI**: `http://localhost:12345`
- **Grafana UI**: `http://localhost:3000`

## File Structure

```
grafana/logs-file/
├── README.md                    # This documentation
├── config.alloy                # Alloy agent configuration
├── docker-compose.yml          # Container orchestration
├── loki-config.yaml            # Loki storage configuration
├── main.py                     # Sample log generator (unused)
├── start.sh                    # Startup script
└── stop.sh                     # Shutdown script
```

## Management Scripts

### start.sh
Intelligent startup script that:
- Checks if containers are already running
- Starts the stack only if needed (idempotent)
- Provides clear status feedback and access URLs
- Works from any directory

### stop.sh
Clean shutdown script that:
- Checks container status before attempting shutdown
- Uses `docker-compose down` for proper cleanup
- Provides clear feedback on shutdown progress
- Works from any directory

## Features

- **Automatic Log Discovery**: Monitors the Quanta logs directory for all `.log` files
- **Real-time Monitoring**: New log entries are ingested as they're written
- **Historical Data**: Existing log files are read in their entirety
- **Persistent Storage**: Logs are stored in Loki for historical querying
- **Web Interface**: Easy visualization and searching through Grafana
- **Scalable**: Handles multiple log files and growing log volumes

## Viewing Logs in Grafana

1. **Access Grafana**: Go to `http://localhost:3000`
2. **Navigate to Explore**: Click the compass icon (🧭) in the left sidebar
3. **Select Loki Data Source**: Ensure "Loki" is selected in the dropdown
4. **Query Your Logs**: Use `{job="quanta"}` to see all Quanta logs
5. **Adjust Time Range**: If needed, expand to "Last 24 hours" or "Last 7 days"

## Troubleshooting

### No Logs Found in Grafana
If you see "No logs found" when querying `{job="quanta"}`:

1. **Check Container Status**: 
   ```bash
   cd grafana/logs-file && docker-compose ps
   ```
   All containers should show "Up" status.

2. **Verify Log File Access**:
   ```bash
   docker exec logs-file-alloy-1 ls -la /temp/logs/
   ```
   You should see your log files listed.

3. **Check Alloy Logs**:
   ```bash
   docker logs logs-file-alloy-1 --tail 10
   ```
   Look for "tail routine: started" and "Seeked" messages.

4. **Path Issues**: If using relative paths in docker-compose.yml doesn't work, try absolute paths like `/home/clay/ferguson/quanta/dist/server/logs:/temp/logs`

5. **State Reset**: If Alloy was previously running with different settings, stop containers completely and restart:
   ```bash
   docker-compose down && docker-compose up -d
   ```

6. **Wait for Pipeline**: Data can take 30-60 seconds to flow through Alloy → Loki → Grafana

### Common Issues
- **Volume Mount Problems**: Use absolute paths for reliable log file access
- **Time Range**: Ensure Grafana time picker includes when your logs were written
- **Container Connectivity**: Verify all three containers are running and healthy