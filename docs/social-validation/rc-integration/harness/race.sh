#!/bin/bash
export DOCKER_HOST=unix://$HOME/.colima/haratna-backup/docker.sock
docker exec -e DB=rc_rehearsal supabase_db_haratna-social-synthetic bash /tmp/rc/tests/concurrency/resilience_race.sh 2>&1
