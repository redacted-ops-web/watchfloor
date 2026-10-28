# INTSUM push service

Sends a notification to subscribed browsers when a refresh adds or escalates a severe or critical item.

Build and run on the server:

    docker build -t watchfloor-push /Volume2/Media2/docker/watchfloor/server/push
    mkdir -p /Volume2/Media2/docker/watchfloor-push && chmod 777 /Volume2/Media2/docker/watchfloor-push
    docker run -d --name watchfloor-push --restart unless-stopped -p 8791:8791 \
      -v /Volume2/Media2/docker/watchfloor-push:/data -v /Volume2/Media2/docker/watchfloor:/site:ro watchfloor-push

Caddy route inside the watchfloor site block:

    handle /push/* {
        reverse_proxy 192.168.1.242:8791
    }

Files in /data: vapid.json (the signing keys, keep private), subs.json (subscribers), state.json.
