-- Project teams: a team can be flagged kind = 'project'. For such teams the
-- Rocks page becomes a Milestones page (milestones with no parent rock, owned
-- by the team), and to-dos / issues can hang off a milestone.
create type team_kind as enum ('standard', 'project');

alter table teams add column kind team_kind not null default 'standard';

alter table todos add column milestone_id text references milestones(id) on delete set null;
create index on todos (milestone_id);
