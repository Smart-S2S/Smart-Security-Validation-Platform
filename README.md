# Smart Security Validation Platform (SSVP)

## Overview
SSVP is an AI-assisted security validation and test attack platform for authorized environments like Labs, Own VMs.

### Current Features
- FastAPI backend
- Background scan jobs
- Live activity log
- Nmap integration
- Ollama integration
- AI-generated security analysis

### Stack
- Ubuntu
- Python 3.12
- FastAPI
- Ollama
- Nmap

## Database
SSVP now uses MySQL for persistent data storage.

Stored in MySQL:
- auth data (users, roles, sessions)
- app settings
- offers

### Required MySQL env vars
- MYSQL_HOST (default: 127.0.0.1)
- MYSQL_PORT (default: 3306)
- MYSQL_USER (default: ssvp)
- MYSQL_PASSWORD (default: ssvp123)
- MYSQL_DATABASE (default: ssvp)

### Quick setup
1. Create database:
	CREATE DATABASE ssvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
2. Install python deps:
	pip install -r requirements.txt
3. Start app:
	./run.sh

On first startup, schema is created automatically in MySQL.

To allow remote MySQL access, set `ALLOW_MYSQL_REMOTE=yes` in `setup_mysql_phpmyadmin.sh` and open 3306 only for your IP.
