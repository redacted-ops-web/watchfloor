# Watchfloor

Situational-awareness dashboard: conflict hotspots, shipping chokepoints, cyber incidents, live news streams, Pentagon Pizza Index and S2 Underground map links, and a local-AI analyst.

## Layout
- `index.html` the whole dashboard (static)
- `data/data.json` refreshed by scheduled cloud tasks, which commit here
- `data/channels.json` live news channel list
- `server/ollama-proxy.js` runs on the PC with Ollama (Node 18+, no dependencies)
- `server/Caddyfile.example` Caddy block for the Linux server
- `server/pull-data.sh` cron job on the Linux server, pulls this repo into /srv/watchfloor

## Flow
Cloud refresh -> commit data/data.json -> Linux server pulls every 5 min -> Caddy serves the site; `/api/*` is proxied to the PC proxy -> Ollama.

## Proxy
    ALLOW=<linux server LAN IP> MODEL=qwen2.5:14b-instruct-q6_K node server/ollama-proxy.js
Only addresses in ALLOW can connect. Also limit port 8787 in the Windows firewall to that IP.
