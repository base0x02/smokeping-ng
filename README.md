# smokeping-ng

A modern, self-hosted replacement for [SmokePing](https://oss.oetiker.ch/smokeping/). It pings your endpoints on a fixed schedule and draws SmokePing-style "smoke" graphs of latency, jitter and packet loss, with a React UI, a Postgres backend and a one-command Docker setup.

## Features

### Monitoring
- **fping-based probing.** Each endpoint sends a configurable burst of pings (20 by default) every interval (300 s by default). Every individual RTT is stored, not just the average.
- **Wall-clock-aligned schedule.** A 300 s endpoint is always probed at :00, :05, :10, …, no matter when the service started. Slots missed while it was down are skipped rather than run late, so samples line up across endpoints.
- **Live config.** Endpoints you add or edit are picked up at their next slot without a restart.

### Graphs
- **SmokePing-style smoke graphs** (ECharts): median line colored by packet loss, with layered smoke bands showing the spread of the individual pings.
- **Time ranges** from the last hour to the last 90 days, or a custom range, plus a zoom slider on the time axis.
- **Endpoint page** with a y-axis zoom slider and a 250 ms y-axis floor so quiet links stay readable.
- **Graph size zoom** in the header: seven sizes, from many small graphs per screen to a few large ones. Saved per browser.
- **Optional legend** that can be hidden, or shown at the top or bottom of the screen.

### Organization
- **Nested groups** (e.g. Region → Country → Site) with a navigation drawer and per-group pages.
- **Grouped dashboard.** Graphs can be boxed by group, and the boxes are packed to fill the screen with as little empty space as possible.
- **Group depth.** Group by the top level only, two levels, or the full tree. Deeper groups fold into their parent's box.
- Click a graph's title to open that endpoint's page.

### Problem alerts
- Each endpoint's last 30 minutes are compared with its own previous 7 days. An endpoint is flagged when most recent samples agree that it is:
  - **down**: no replies at all
  - **lossy**: sustained packet loss well above its usual rate
  - **slow**: median RTT much higher than usual (at least 1.5× and +10 ms)
- A warning icon with a count appears in the header. It opens a **Problems** page showing just the affected graphs, with the reason and how long each has been going on.
- Problem graphs are also highlighted on the dashboard and group pages.

### SmokePing migration
- **Import a SmokePing `Targets` config.** Groups and endpoints are recreated from the `+`/`++` hierarchy, using `menu` names, `host`, and `pings`/`step` from the Database section. Non-FPing probes and multi-host graphs are skipped and listed in the preview.
- **Import RRD history.** SmokePing `.rrd` files are parsed natively (no `rrdtool` needed) and converted into this app's measurements, so your old graphs carry over. The finest-resolution archive is used for each period, and data never overwrites measurements already collected.
- Available in the Admin page (pick the `Targets` file and the data folder, preview, then import) or from the command line:

  ```bash
  cd backend
  npm run import:smokeping -- --config /path/to/Targets --data /path/to/smokeping/data --dry-run
  ```

  Drop `--dry-run` to apply. Needs `DATABASE_URL` set.

### Appearance
- Six color palettes (Classic, Slate, Forest, Ocean, Rose, Solar), each with a light and dark mode, previewed in the Admin page.
- Page title and subtitle in the top bar. All preferences are stored in the browser.

### Admin
- Create, edit and delete groups and endpoints (name, host, group, ping count, interval, enabled).
- Delete an endpoint straight from its edit dialog.
- Recent probe runs per endpoint (sent/received, RTT, jitter, loss).

## Quick start

Requires Docker with Compose.

```bash
cp .env.example .env   # set POSTGRES_PASSWORD
docker compose up -d --build
```

Open http://localhost:8080 and add endpoints in **Admin**, or import a SmokePing config there.

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `smokeping` | Database credentials |
| `APP_PORT` | `8080` | Port the web UI is published on |

The app container needs `NET_RAW` (already set in `docker-compose.yml`) so fping can send ICMP. Database migrations run automatically on start.

> **Note:** there is no built-in authentication. Run it on a trusted network or behind a reverse proxy that adds auth.

## Development

```bash
docker compose up -d db
cd backend && npm install && DATABASE_URL=postgres://smokeping:smokeping@localhost:5432/smokeping npm run db:migrate && npm run dev
cd frontend && npm install && npm run dev
```

`npm run db:seed-demo` in `backend/` adds a demo endpoint with generated history.

**Stack:** Node 20, Fastify, Drizzle ORM, PostgreSQL 16 · React 18, Vite, TanStack Query, ECharts, Tailwind CSS.

## Tips

- **Running behind a VPN?** Container pings follow the host's routing table, so per-app VPN split tunneling usually won't exclude ICMP. For accurate results, run smokeping-ng on a machine that isn't on the VPN.
