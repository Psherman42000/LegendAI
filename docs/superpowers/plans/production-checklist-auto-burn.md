# Production Checklist - Auto Burn Pipeline

- [ ] `REDIS_URL` configured and reachable from web + worker
- [ ] Worker process supervised (pm2/systemd/docker restart policy)
- [ ] FFmpeg executable verified (`ffmpeg -version`)
- [ ] Whisper provider health verified (`/health` for API mode)
- [ ] R2 upload/download smoke test executed
- [ ] End-to-end upload test confirms `READY` with `processedUrl` + `srtUrl`
- [ ] Alerting configured for queue failures and repeated ERROR status
