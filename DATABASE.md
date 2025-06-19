# Database Setup

This project now includes PostgreSQL and pgAdmin in the Docker Compose setup.

## Services

### PostgreSQL Database
- **Container**: `quanta-postgres-dev`
- **Port**: `5432`
- **Database**: `quanta`
- **Username**: `quanta`
- **Password**: `***`

### pgAdmin Web Interface
- **Container**: `quanta-pgadmin-dev`
- **URL**: http://localhost:5050
- **Email**: `admin@quanta.dev`
- **Password**: `***`

## Usage

1. Start all services: `./run-dev.sh`
2. Access pgAdmin at: http://localhost:5050
3. Login with email: `admin@quanta.dev` and password: `admin123`
4. Connect to PostgreSQL server:
   - Host: `postgres` (or `localhost` from host machine)
   - Port: `5432`
   - Database: `quanta`
   - Username: `quanta`
   - Password: `***`

## Environment Variables Available in App

The following environment variables are available in your Quanta app container:
- `POSTGRES_HOST=postgres`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=quanta`
- `POSTGRES_USER=quanta`
- `POSTGRES_PASSWORD=***`

