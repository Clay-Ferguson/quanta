# pgAdmin Web Interface Guide

This guide covers how to use the pgAdmin web interface to connect to and browse your PostgreSQL database in the Quanta development environment.

## Accessing pgAdmin

When running the Docker Compose stack with the pgAdmin profile enabled, pgAdmin will be available at:
- **URL**: `http://localhost:5050/browser/`
- **Port**: 5050 (configurable via `PGADMIN_PORT` in `.env`)

## Initial Login

### Credentials
Use the credentials defined in your `../.env-quanta` file:
- **Email**: Value of `PGADMIN_DEFAULT_EMAIL`
- **Password**: Value of `PGADMIN_DEFAULT_PASSWORD`

## Connecting to Your Database

### Step 1: Register a New Server
1. **Right-click** on "Servers" in the left panel
2. Select **"Register" → "Server..."**

### Step 2: Configure Connection Settings

**General Tab:**
- **Name**: Enter a descriptive name (e.g., "Quanta Dev Database")

**Connection Tab:**
- **Host name/address**: `postgres` (Docker service name)
- **Port**: `5432`
- **Maintenance database**: `quanta`
- **Username**: `quanta`
- **Password**: Value from `POSTGRES_PASSWORD` in your `../.env-quanta` file

### Step 3: Save and Connect
- Click **"Save"** to create the connection
- The server will appear under "Servers" in the left panel

## Browsing Database Structure

### Navigate to Your Tables
1. Expand your server connection
2. Expand **"Databases" → "quanta"**
3. Expand **"Schemas" → "public"**
4. Click on **"Tables"** to see all tables

## Viewing Table Data

### Method 1: Right-Click Context Menu (Recommended)
1. **Right-click** on any table name
2. Select **"View/Edit Data"**
3. Choose your preferred option:
   - **"All Rows"** - Shows complete table contents
   - **"First 100 Rows"** - Shows first 100 records (good for large tables)
   - **"Last 100 Rows"** - Shows most recent 100 records
   - **"Filtered Rows..."** - Add custom WHERE clause for filtering

### Method 2: Table Properties Panel
1. **Click once** on a table name to select it
2. Look for the **"Data"** tab in the main panel (if available)
3. Click the tab to view table contents

### Method 3: Query Tool (Most Flexible)
1. **Right-click** on the database name ("quanta")
2. Select **"Query Tool"**
3. Write custom SQL queries:
   ```sql
   SELECT * FROM table_name;
   SELECT * FROM table_name LIMIT 10;
   SELECT column1, column2 FROM table_name WHERE condition;
   ```
4. Click **"Execute"** button (▶️) or press **F5**

## Understanding the Data View

When viewing table data, you'll see:
- **Grid Layout**: Spreadsheet-like table with rows and columns
- **Column Headers**: Field names from your database schema
- **Navigation Controls**: Page through results if there are many rows
- **Row Counts**: Total number of records displayed
- **Sorting**: Click column headers to sort data

## Common Tasks

### Viewing All Tables at Once
- Expand "Tables" in the left panel to see all available tables
- Each plugin (docs, chat) may have its own set of tables

### Refreshing Data
- **Right-click** on "Tables" and select **"Refresh"** to update the list
- **F5** in data views refreshes the current query results

### Searching Within Tables
- Use **"View/Edit Data" → "Filtered Rows..."** for custom filtering
- Or use the Query Tool with WHERE clauses for complex searches

## Troubleshooting

### Can't Connect to Database
- Verify PostgreSQL container is running: `docker-compose ps`
- Check that you're using `postgres` as the hostname (not `localhost`)
- Confirm credentials match those in your `../.env-quanta` file

### No Tables Visible
- Make sure your application has run and created the database schema
- Check that you're looking in the correct database (`quanta`)
- Verify you're in the `public` schema

### Performance with Large Tables
- Use "First 100 Rows" instead of "All Rows" for large datasets
- Consider using the Query Tool with LIMIT clauses
- Use filtered queries to narrow down results

## Environment Configuration

The pgAdmin service is configured in `docker-compose.yaml` with:
- **Profile**: `pgadmin` (must be explicitly enabled)
- **Image**: `dpage/pgadmin4:latest`
- **Port Mapping**: Host 5050 → Container 80
- **Data Persistence**: `../quanta-volumes/dev/pgadmin-data`

### Starting with pgAdmin Profile
```bash
# Include --profile pgadmin to start pgAdmin service
docker-compose --env-file ./build/dev/.env --env-file ../.env-quanta --profile pgadmin up
```

## Security Notes

- pgAdmin is configured for development use (`SERVER_MODE=False`)
- Default credentials should be changed for production environments
- The interface is only accessible on localhost in the development setup
- Database connections use the internal Docker network for security