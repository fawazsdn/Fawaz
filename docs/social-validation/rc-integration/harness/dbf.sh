#!/bin/bash
# usage: dbf.sh <db> <file-in-container> [role]  -- runs one file as a single transaction
export DOCKER_HOST=unix://$HOME/.colima/haratna-backup/docker.sock
docker exec supabase_db_haratna-social-synthetic psql -U "${3:-supabase_admin}" -d "$1" -v ON_ERROR_STOP=1 -X -q -1 -f "$2" 2>&1
