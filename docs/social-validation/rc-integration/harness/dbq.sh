#!/bin/bash
export DOCKER_HOST=unix://$HOME/.colima/haratna-backup/docker.sock
docker exec supabase_db_haratna-social-synthetic psql -U supabase_admin -d "$1" -X -At -c "$2" 2>&1
