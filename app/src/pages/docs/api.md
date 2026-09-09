---
layout: ../../layouts/DocLayout.astro
title: API · GYE EOS
---

# GYE EOS API — Third-Party Integration

**Base URL:** `https://<your-deployment>/api/v1` (locally: `http://localhost:6133/api/v1`)

## Authentication

Every request must send:

```
Authorization: Bearer <API_KEY>
```

Valid keys come from the `API_KEYS` environment variable on the server — a comma-separated list of allowed tokens. Each third-party consumer should get its own key so access can be revoked independently.

## Discovery

`GET /api/v1` returns a JSON catalog of every available endpoint. Start there to sanity-check your auth and see the current surface.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/employees` | List employees. Optional `?email=` filter. |
| GET | `/api/v1/contacts` | Optional `?q=` name search, `?category=`, `?employee_id=`. |
| GET | `/api/v1/teams` | List teams with members. Each team carries `kind`: `standard` or `project`. |
| GET | `/api/v1/rocks` | List non-archived rocks with milestones and quarter. |
| GET | `/api/v1/milestones` | Optional `?team_id=` / `?team_name=`, `?include_archived=1`. Each carries `todo_counts`. |
| POST | `/api/v1/milestones` | Create a milestone (standalone under a project team, or under a rock). |
| PATCH | `/api/v1/milestones` | Update title, description, owner, due date, status, archive flag. |
| GET | `/api/v1/issues` | Optional `?assignee=<email>`, `?team_id=`, `?status=`, `?term=short_term\|long_term`. |
| POST | `/api/v1/issues` | Create an issue. |
| PATCH | `/api/v1/issues` | Mark an issue solved/open. |
| GET | `/api/v1/todos` | Optional `?assignee=<email>`, `?team_id=` / `?team_name=`, `?milestone_id=`, `?status=open\|done\|archived\|all` (default `open`). |
| POST | `/api/v1/todos` | Create a todo, optionally under a milestone. |
| PATCH | `/api/v1/todos` | Update a todo: done/open, urgency, due date, assignee, milestone, title, description. |
| GET | `/api/v1/measurables` | List scorecard measurables, optionally with recent values inline. |
| PUT | `/api/v1/measurables` | Upsert (or delete) a weekly/monthly value. |
| GET | `/api/v1/vto` | Get the singleton V/TO (vision + traction + SWOT). |

### Write bodies

**`POST /api/v1/issues`**

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "owner_email": "alice@gye.org",
  "team_id": "…",
  "team_name": "Finance",
  "term_type": "short_term | long_term (default short_term)",
  "type": "string (optional)",
  "priority": 1
}
```

Returns `{ "id": "…" }`. `team_id` and `team_name` are mutually exclusive.

**`PATCH /api/v1/issues`**

```json
{ "id": "…", "solved": true }
```

`solved` defaults to `true` if omitted.

**`POST /api/v1/todos`**

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "assignee_email": "alice@gye.org",
  "team_id": "…",
  "team_name": "Finance",
  "milestone_id": "… (optional; project teams)",
  "due_date": "2026-04-20",
  "is_urgent": false
}
```

Returns `{ "id": "…" }`. New todos start in `open` status. `team_id` / `team_name` are mutually exclusive.

**`PATCH /api/v1/todos`**

```json
{ "id": "…", "done": true, "milestone_id": "…", "due_date": "2026-09-22", "assignee_email": "alice@gye.org", "title": "…", "description": "…" }
```

Every field except `id` is optional. Pass `null` or `""` for `milestone_id`, `due_date` or `assignee_email` to clear it.

### Project teams and milestones

A team with `kind = project` runs as a project rather than an EOS team: its Rocks page becomes a Milestones page, milestones stand alone (no parent rock), and to-dos and issues can hang off a milestone. Seed a project plan by creating one milestone per phase, then to-dos with `milestone_id`.

**`GET /api/v1/milestones?team_name=2026%20High%20Holidays`**

```json
{
  "milestones": [
    {
      "id": "…",
      "title": "Before launch",
      "status": "on_track",
      "due_date": "2026-09-10",
      "rock_id": null,
      "team": { "id": "…", "name": "2026 High Holidays" },
      "owner": { "id": "…", "name": "…", "email": "…" },
      "todo_counts": { "open": 12, "total": 15 }
    }
  ],
  "count": 1
}
```

**`POST /api/v1/milestones`**

```json
{
  "title": "string (required)",
  "team_id": "…",
  "team_name": "2026 High Holidays",
  "description": "string (optional)",
  "owner_email": "alice@gye.org",
  "due_date": "2026-09-10",
  "status": "on_track | off_track | done (default on_track)",
  "rock_id": "… (optional; only for milestones under a rock)"
}
```

Returns `{ "id": "…" }`.

**`PATCH /api/v1/milestones`**

```json
{ "id": "…", "title": "…", "description": "…", "owner_email": "…", "due_date": "…", "status": "done", "is_archived": false }
```

Every field except `id` is optional.

### Measurables (scorecard)

`GET /api/v1/measurables` returns scorecard measurables — the per-team weekly or monthly metrics. By default it returns just the metric definitions (no historical values).

**Query parameters**

| Param | Purpose |
|---|---|
| `team_id` / `team_name` | Filter to one team (mutually exclusive). `team_name` is case-insensitive. |
| `owner` (or `assignee`) | Filter by owner email. |
| `frequency` | `weekly` or `monthly`. |
| `group` | Filter by the `group` column (top-level category on the scorecard). |
| `include_archived` | `1` to include archived measurables. |
| `include_values` | `1` to include recent values inline on each measurable. |
| `weeks` | When `include_values=1`, how many recent weeks to return (default `13`, max `260`). |
| `months` | When `include_values=1`, how many recent months to return (default `6`, max `60`). |
| `from`, `to` | `YYYY-MM-DD` window for `include_values`. Overrides `weeks`/`months`. Both inclusive; weekly uses `week_start_date` (Sunday), monthly uses `month_start_date` (1st). |

**Response shape**

```json
{
  "measurables": [
    {
      "id": "…",
      "name": "Inbound calls",
      "description": null,
      "frequency": "weekly",
      "goal": 25,
      "value_type": "number",
      "threshold_type": "minimum",
      "group": "Sales",
      "subgroup": null,
      "display_order": 0,
      "show_average": true,
      "is_archived": false,
      "created_at": "…",
      "updated_at": "…",
      "team": { "id": "…", "name": "Leadership" },
      "owner": { "id": "…", "name": "Alice", "email": "alice@gye.org" },
      "values": [
        { "date": "2026-04-19", "value": 27, "note": null },
        { "date": "2026-04-12", "value": 22, "note": "holiday week" }
      ]
    }
  ],
  "count": 1
}
```

`values` is only present when `include_values=1`. Dates are `week_start_date` (Sunday) for weekly metrics or `month_start_date` (1st of the month) for monthly metrics, sorted newest first.

**`PUT /api/v1/measurables`** — upsert a weekly or monthly value.

```json
{
  "measurable_id": "…",
  "date": "2026-04-19",
  "value": 27,
  "note": "optional",
  "frequency": "weekly"
}
```

- `measurable_id` and `date` are required. `date` must be `YYYY-MM-DD` and should be the period's start date — Sunday for weekly, the 1st for monthly. Other dates are stored verbatim.
- `frequency` defaults to the measurable's own `frequency` and rarely needs to be set.
- `value` may be `null` or omitted to clear just the numeric value while keeping a note.
- If both `value` and `note` are empty/null, the entry for that period is **deleted**.

Returns one of:

```json
{ "measurable_id": "…", "date": "2026-04-19", "frequency": "weekly", "value": 27, "note": null }
```

```json
{ "measurable_id": "…", "date": "2026-04-19", "frequency": "weekly", "deleted": true }
```

## Examples

```bash
# Discovery
curl -H "Authorization: Bearer $EOS_API_KEY" https://your-host/api/v1

# Create a todo for a user by email
curl -X POST https://your-host/api/v1/todos \
  -H "Authorization: Bearer $EOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Follow up with vendor","assignee_email":"alice@gye.org","team_name":"Finance","due_date":"2026-04-20"}'

# List open todos for a user
curl -H "Authorization: Bearer $EOS_API_KEY" \
  "https://your-host/api/v1/todos?assignee=alice@gye.org&status=open"

# Mark a todo done
curl -X PATCH https://your-host/api/v1/todos \
  -H "Authorization: Bearer $EOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<todo-id>"}'

# List one team's weekly measurables with the last 8 weeks of values
curl -H "Authorization: Bearer $EOS_API_KEY" \
  "https://your-host/api/v1/measurables?team_name=Leadership&frequency=weekly&include_values=1&weeks=8"

# Record this week's value for a measurable
curl -X PUT https://your-host/api/v1/measurables \
  -H "Authorization: Bearer $EOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"measurable_id":"<id>","date":"2026-04-19","value":27}'
```

## Error format

All errors are JSON:

```json
{ "error": "unauthorized" }
```

| Status | Meaning |
|---|---|
| `401` | Missing or invalid `Authorization` header |
| `400` | Validation error (missing required field, bad id, mutually-exclusive fields both set) |
| `500` | Server error, or `API_KEYS` not configured |

## Notes & limits

- Responses are pretty-printed JSON with `cache-control: no-store`.
- `team_name` lookups are case-sensitive.
- **Read-only resources** (no POST/PATCH/DELETE): employees, contacts, teams, rocks, V/TO. Measurables are read-only for definitions, but `PUT` upserts a single weekly/monthly value.
- **Posts** (the unified updates/testimonials entity) is not exposed on `/api/v1` yet. Open an issue if an integration needs it.

## Environment variables (server side)

| Var | Purpose |
|---|---|
| `API_KEYS` | Comma-separated list of valid bearer tokens. Missing → API returns 500. |
| `EOS_API_URL`, `EOS_API_KEY` | Consumer-side convention for clients that call this API. |
