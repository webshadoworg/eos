-- Quarters: explicit periods for rocks. GYE quarters are loose (e.g. Q1 2026
-- ran Jan 16 – Apr 30), so they're defined manually rather than derived from
-- calendar dates. "Current quarter" = the one containing today.
create table quarters (
  id          text primary key default new_id(),
  label       text not null,
  description text,
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger quarters_set_updated_at
  before update on quarters
  for each row execute function set_updated_at();

alter table quarters enable row level security;

alter table rocks add column quarter_id text references quarters(id) on delete set null;

create index on rocks (quarter_id);

-- Seed known quarters.
insert into quarters (label, description, start_date, end_date) values
  ('Q4 2025', null, '2025-10-01', '2026-01-15'),
  ('Q1 2026', null, '2026-01-16', '2026-04-30'),
  ('Q2 2026', null, '2026-05-01', '2026-08-31');

-- Backfill existing rocks into the quarter containing their due date
-- (anything due on/before Jan 15 lands in Q4 2025); rocks without a
-- due date go to the current quarter (Q2 2026).
update rocks r
set quarter_id = q.id
from quarters q
where r.quarter_id is null
  and r.due_date is not null
  and r.due_date <= q.end_date
  and (r.due_date >= q.start_date or q.label = 'Q4 2025');

update rocks r
set quarter_id = (select id from quarters where label = 'Q2 2026')
where r.quarter_id is null;
