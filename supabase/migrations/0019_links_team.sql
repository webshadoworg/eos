-- Links can be scoped to a team (project). team_id null = org-wide, as before.
alter table links add column team_id text references teams(id) on delete cascade;
create index on links (team_id);
