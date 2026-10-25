begin;

create schema if not exists mind_lab_private;
revoke all on schema mind_lab_private from public, anon, authenticated;

create table if not exists public.ml_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  username_key text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.ml_games (
  id text primary key,
  version text not null,
  kind text not null
);
insert into public.ml_games (id, version, kind) values
  ('schulte-table', 'schulte-table-1', 'time'),
  ('sequence-memory', 'sequence-memory-1', 'span'),
  ('letter-number-sequencing', 'letter-number-1', 'span'),
  ('picture-span', 'picture-span-simple-3', 'span'),
  ('symbol-span', 'symbol-span-geometric-4', 'span'),
  ('symmetry-span', 'symmetry-simple-levels-2', 'levels'),
  ('symmetry-span-plus-plus', 'symmetry-plus-plus-levels-4', 'levels'),
  ('rotation-span', 'rotation-levels-2', 'levels'),
  ('spatial-updating', 'spatial-updating-levels-3', 'levels'),
  ('arithmetic-updating', 'arithmetic-updating-levels-3', 'levels'),
  ('multi-stream-running-span', 'multi-stream-running-span-levels-3', 'levels'),
  ('multiple-object-tracking', 'mot-levels-1', 'levels'),
  ('digit-symbol-coding', 'speed-simple-30s-2', 'speed'),
  ('symbol-search', 'speed-simple-30s-2', 'speed'),
  ('pattern-comparison', 'speed-simple-30s-2', 'speed'),
  ('target-cancellation', 'speed-simple-30s-2', 'speed'),
  ('flanker', 'control-1', 'control'),
  ('stroop', 'control-1', 'control'),
  ('psychomotor-vigilance', 'reaction-30s-2', 'pvt'),
  ('choice-reaction', 'reaction-30s-2', 'choice'),
  ('go-no-go', 'reaction-30s-2', 'gonogo')
on conflict (id) do update set version = excluded.version, kind = excluded.kind;

create table if not exists public.ml_conditions (
  id text primary key,
  game_id text not null references public.ml_games(id),
  version text not null,
  rules jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ml_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.ml_profiles(id) on delete cascade,
  game_id text not null references public.ml_games(id),
  condition_id text not null references public.ml_conditions(id),
  client_id text not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  record jsonb not null,
  unique (user_id, game_id, client_id)
);
create index if not exists ml_records_owner_history on public.ml_records(user_id, game_id, id desc);
create table if not exists public.ml_scores (
  record_id bigint not null references public.ml_records(id) on delete cascade,
  user_id uuid not null references public.ml_profiles(id) on delete cascade,
  condition_id text not null references public.ml_conditions(id),
  metric text not null,
  value double precision not null check (value not in ('Infinity'::float8, '-Infinity'::float8, 'NaN'::float8)),
  lower_is_better boolean not null,
  ended_at timestamptz not null,
  primary key (record_id, metric)
);
create index if not exists ml_scores_personal on public.ml_scores(user_id, condition_id, metric, ended_at desc, record_id desc);
create table if not exists public.ml_bests (
  user_id uuid not null references public.ml_profiles(id) on delete cascade,
  condition_id text not null references public.ml_conditions(id),
  metric text not null,
  value double precision not null,
  sort_value double precision not null,
  record_id bigint not null references public.ml_records(id) on delete cascade,
  primary key (user_id, condition_id, metric)
);
create index if not exists ml_bests_ranking on public.ml_bests(condition_id, metric, sort_value, user_id);
create table if not exists public.ml_board_revisions (
  game_id text primary key references public.ml_games(id),
  revision bigint not null default 0
);
insert into public.ml_board_revisions(game_id) select id from public.ml_games on conflict do nothing;

alter table public.ml_profiles enable row level security;
alter table public.ml_games enable row level security;
alter table public.ml_conditions enable row level security;
alter table public.ml_records enable row level security;
alter table public.ml_scores enable row level security;
alter table public.ml_bests enable row level security;
alter table public.ml_board_revisions enable row level security;
revoke all on public.ml_profiles, public.ml_games, public.ml_conditions, public.ml_records,
  public.ml_scores, public.ml_bests, public.ml_board_revisions from anon, authenticated;
grant select on public.ml_profiles, public.ml_records to authenticated;
grant select on public.ml_board_revisions to anon, authenticated;
drop policy if exists ml_own_profile on public.ml_profiles;
create policy ml_own_profile on public.ml_profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists ml_own_records on public.ml_records;
create policy ml_own_records on public.ml_records for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ml_public_revisions on public.ml_board_revisions;
create policy ml_public_revisions on public.ml_board_revisions for select to anon, authenticated using (true);

create or replace function mind_lab_private.new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  name text := btrim(normalize(new.raw_user_meta_data->>'username', NFKC));
  name_key text;
begin
  if name is null or char_length(name) not between 2 and 24 or name ~ '[[:cntrl:]]' then
    raise exception 'invalid_username';
  end if;
  name_key := translate(name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
  if new.email is distinct from encode(sha256(convert_to(name_key, 'UTF8')), 'hex') || '@users.mind-lab.invalid' then
    raise exception 'invalid_username_identity';
  end if;
  insert into public.ml_profiles(id, username, username_key) values (new.id, name, name_key);
  return new;
end;
$$;
drop trigger if exists mind_lab_user_created on auth.users;
create trigger mind_lab_user_created after insert on auth.users for each row execute function mind_lab_private.new_user();

create or replace function mind_lab_private.condition_id(game text, version text, rules jsonb) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_array(game, version, rules)::text, 'UTF8')), 'hex');
$$;

create or replace function mind_lab_private.level_pass(game text, trial jsonb, rules jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  j jsonb; e jsonb; item jsonb; states jsonb; expected jsonb := '[]'; cells jsonb;
  i integer; n integer; p integer; q integer; side integer; channel integer; v integer; tail integer;
  lr boolean; tb boolean; answer text;
begin
  if game = 'multiple-object-tracking' then
    return jsonb_array_length(trial->'targets') > 0
      and jsonb_array_length(trial->'targets') = jsonb_array_length(trial->'selected')
      and trial->'targets' @> trial->'selected' and trial->'selected' @> trial->'targets';
  elsif game in ('spatial-updating', 'arithmetic-updating', 'multi-stream-running-span') then
    n := (trial->>'channels')::integer; tail := (trial->>'tail')::integer;
    if n < 2 or tail not between 1 and 4 or jsonb_array_length(trial->'responses') <> n then raise exception 'invalid_trial'; end if;
    states := case when game = 'multi-stream-running-span' then (select jsonb_agg('[]'::jsonb) from generate_series(1,n)) else trial->'initial' end;
    for e in select value from jsonb_array_elements(trial->'events') loop
      channel := (e->>'channel')::integer; v := (e->>'value')::integer;
      if channel not between 0 and n-1 then raise exception 'invalid_channel'; end if;
      if game = 'multi-stream-running-span' then
        if v not between 0 and 9 then raise exception 'invalid_digit'; end if;
        item := (states->channel) || to_jsonb(v);
        if jsonb_array_length(item) > tail then item := item - 0; end if;
      elsif game = 'arithmetic-updating' then
        if v not in (-1,1) then raise exception 'invalid_update'; end if;
        item := to_jsonb((states->>channel)::integer + v);
      else
        if v not between 0 and 3 then raise exception 'invalid_direction'; end if;
        p := (states->>channel)::integer;
        item := to_jsonb(case v when 0 then mod(p / 3 + 2, 3)*3 + mod(p,3)
          when 1 then (p / 3)*3 + mod(p+1,3) when 2 then mod(p / 3 + 1,3)*3+mod(p,3)
          else (p / 3)*3+mod(p+2,3) end);
      end if;
      states := jsonb_set(states, array[channel::text], item);
    end loop;
    if game <> 'multi-stream-running-span' then select jsonb_agg(jsonb_build_array(value)) into states from jsonb_array_elements(states); end if;
    return states = trial->'responses';
  end if;
  if game = 'rotation-span' then
    if trial->'arrows' <> trial->'responses' then return false; end if;
    for j in select value from jsonb_array_elements(trial->'judgments') loop
      if j->'response' is distinct from j->'mirrored' or (j->>'timedOut')::boolean then return false; end if;
    end loop;
    return true;
  end if;
  side := case when game = 'symmetry-span' then 4 else (rules->>'size')::integer end;
  if side not in (4,6) then raise exception 'invalid_size'; end if;
  n := jsonb_array_length(trial->'positions');
  for i in 0..n-1 loop
    p := (trial->'positions'->>(case when rules->>'order' = 'reverse' then n-1-i else i end))::integer;
    if rules->>'transform' = 'rotated' then p := mod(p,side)*side + side-1-p/side;
    elsif rules->>'transform' = 'counterclockwise' then p := (side-1-mod(p,side))*side+p/side; end if;
    expected := expected || to_jsonb(p);
  end loop;
  if expected <> trial->'responses' then return false; end if;
  for j in select value from jsonb_array_elements(trial->'judgments') loop
    if (j->>'timedOut')::boolean then return false; end if;
    lr := true; tb := true;
    if game = 'symmetry-span' then
      cells := j->'cells';
      for p in 0..15 loop
        q := (p / 4)*4 + 3-mod(p,4);
        if cells->p <> cells->q then lr := false; end if;
      end loop;
      if j->'response' is distinct from to_jsonb(lr) then return false; end if;
    else
      select jsonb_agg(value->'target') into cells from jsonb_array_elements(j->'frames');
      for item in select value from jsonb_array_elements(cells) loop
        p := item::integer;
        if not cells @> to_jsonb((p/side)*side+side-1-mod(p,side)) then lr := false; end if;
        if not cells @> to_jsonb((side-1-p/side)*side+mod(p,side)) then tb := false; end if;
      end loop;
      answer := j->>'response';
      if not (case answer when 'left-right' then lr when 'top-bottom' then tb when 'neither' then not lr and not tb else false end) then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.ml_submit(p_game_id text, p_record jsonb, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); game public.ml_games%rowtype; cid text; rid bigint; rules jsonb;
  t jsonb; score_item record; values_json jsonb := '{}'; score_value double precision; lower_better boolean;
  ended timestamptz; lev integer := 1; lives integer := 3; passed boolean; previous_end double precision := 0;
  rts double precision[] := '{}'; observed double precision[] := '{}'; rt double precision; target integer; answer integer;
  hits integer := 0; omissions integer := 0; commissions integer := 0; no_go integer := 0; go_count integer := 0;
  premature integer := 0; lapses integer := 0; total integer := 0; correct integer := 0; median_rt double precision;
begin
  if uid is null or uid is distinct from p_owner then raise exception 'authentication_required' using errcode = '28000'; end if;
  if jsonb_typeof(p_record) is distinct from 'object' or octet_length(p_record::text) > 2000000
    or (p_record->>'id') is null or (p_record->>'id') !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'invalid_record'; end if;
  select * into game from public.ml_games where id = p_game_id;
  if not found or p_record#>>'{meta,rulesVersion}' is distinct from game.version then raise exception 'unsupported_rules'; end if;
  rules := p_record#>'{meta,rules}';
  if jsonb_typeof(rules) is distinct from 'object' or octet_length(rules::text) > 2000 then raise exception 'invalid_rules'; end if;
  ended := (p_record->>'endedAt')::timestamptz;
  if ended is null or ended > now() + interval '10 minutes' or ended < timestamptz '2020-01-01' then raise exception 'invalid_date'; end if;
  select id into rid from public.ml_records where user_id=uid and game_id=p_game_id and client_id=p_record->>'id';
  if found then return jsonb_build_object('id',rid,'duplicate',true); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if (select count(*) from public.ml_records where user_id=uid and created_at > now()-interval '1 minute') >= 60 then
    raise exception 'rate_limited' using errcode='P0001';
  end if;
  if game.kind = 'time' then
    if (rules->>'size')::integer not between 5 and 9 or rules->>'direction' not in ('asc','desc')
      or jsonb_typeof(rules->'disappear') <> 'boolean' then raise exception 'invalid_rules'; end if;
    score_value := (p_record->>'elapsedMs')::float8 / 1000;
    if score_value is null or score_value <= 0 then raise exception 'invalid_score'; end if;
    values_json := jsonb_build_object('time',score_value);
  elsif game.kind = 'span' then
    score_value := (p_record->>'score')::float8;
    if score_value is null or score_value < 0 or score_value <> trunc(score_value) or p_record->>'reason' not in ('mistake','stopped','complete') then raise exception 'invalid_score'; end if;
    if p_game_id='picture-span' and rules->>'difficulty' is distinct from 'normal' then raise exception 'invalid_rules'; end if;
    values_json := jsonb_build_object('score',score_value);
  elsif game.kind = 'speed' then
    if p_record->>'duration' is distinct from '30' or rules->>'duration' is distinct from '30' then raise exception 'invalid_duration'; end if;
    if not p_record ?& array['correct','wrong','missed'] then raise exception 'invalid_score'; end if;
    for score_item in select key,value from jsonb_each(p_record) where key in ('correct','wrong','missed') loop
      if jsonb_typeof(score_item.value) <> 'number' or score_item.value::float8 < 0 or score_item.value::float8 <> trunc(score_item.value::float8) then raise exception 'invalid_score'; end if;
    end loop;
    values_json := jsonb_build_object('score',(p_record->>'correct')::float8-(p_record->>'wrong')::float8-(p_record->>'missed')::float8);
  elsif game.kind = 'levels' then
    if p_record->>'status' not in ('complete','stopped') or jsonb_typeof(p_record->'trials') is distinct from 'array'
      or jsonb_array_length(p_record->'trials') < 1 then raise exception 'incomplete_session'; end if;
    for t in select value from jsonb_array_elements(p_record->'trials') loop
      if lives = 0 or (t->>'level')::integer is distinct from lev then raise exception 'invalid_progression'; end if;
      passed := mind_lab_private.level_pass(p_game_id,t,rules);
      if passed is null then raise exception 'invalid_trial'; end if;
      if passed then lev := lev+1; else lives := lives-1; end if;
    end loop;
    if p_record->>'score' is distinct from (lev-1)::text or (p_record->>'lives')::integer is distinct from lives
      or (p_record->>'reason'='lives' and lives<>0) then raise exception 'invalid_score'; end if;
    values_json := jsonb_build_object('score',lev-1);
  elsif game.kind = 'control' then
    if p_record->>'durationMs' is distinct from '30000' or p_record->>'rules' is distinct from '30s-first-error-v1'
      or p_record->>'reason' not in ('error','timeout') then raise exception 'invalid_duration'; end if;
    for t in select value from jsonb_array_elements(p_record->'trials') loop
      if total > hits or (t->>'onsetMs')::float8 < previous_end-.1 then raise exception 'invalid_trial'; end if;
      previous_end := (t->>'onsetMs')::float8+(t->>'rtMs')::float8;
      if previous_end > (p_record->>'elapsedMs')::float8+.1 or previous_end > 30000.1 or (t->>'rtMs')::float8 < 0 then raise exception 'invalid_trial'; end if;
      total := total+1;
      if t->'answer'=t->'target' then hits:=hits+1; end if;
    end loop;
    if (p_record->>'reason'='error' and total<>hits+1) or (p_record->>'reason'='timeout' and (total<>hits or p_record->>'elapsedMs'<>'30000')) then raise exception 'invalid_ending'; end if;
    values_json := jsonb_build_object('score',hits);
  else
    if p_record->>'elapsedMs' is distinct from '30000' or rules->>'durationMs' is distinct from '30000'
      or p_record->>'kind' is distinct from game.kind or jsonb_array_length(p_record->'trials') < 1 then raise exception 'invalid_duration'; end if;
    premature := jsonb_array_length(p_record->'early');
    for t in select value from jsonb_array_elements(p_record->'trials') loop
      total:=total+1; target:=(t->>'target')::integer; answer:=(t->>'answer')::integer; rt:=(t->>'rtMs')::float8;
      if (t->>'onsetMs')::float8 < previous_end-.1 or (t->>'endMs')::float8 > 30000.1
        or (rt is not null and (rt<0 or rt>10000)) then raise exception 'invalid_trial'; end if;
      previous_end:=(t->>'endMs')::float8;
      if game.kind='gonogo' and target=1 then
        no_go:=no_go+1;
        if answer is null then correct:=correct+1; else commissions:=commissions+1; end if;
      else
        go_count:=go_count+1;
        if answer is null then omissions:=omissions+1;
        elsif rt>=100 and answer=target then hits:=hits+1; correct:=correct+1; rts:=array_append(rts,rt); end if;
      end if;
      if rt<100 then premature:=premature+1; end if;
      if game.kind='pvt' and (rt is null or rt>=100) then
        observed:=array_append(observed,case when rt is null then 0 else 1000/rt end);
        if rt is null or rt>=500 then lapses:=lapses+1; end if;
      end if;
    end loop;
    select percentile_cont(.5) within group (order by x) into median_rt from unnest(rts) x;
    values_json:=jsonb_build_object('medianRT',median_rt,'accuracy',100.0*correct/total,'omissions',omissions,'falseStarts',premature);
    if game.kind='pvt' then
      values_json:=values_json||jsonb_build_object('speed',(select avg(x) from unnest(observed) x),
        'lapseRate',100.0*lapses/nullif(cardinality(observed),0),
        'slowRT',(select percentile_disc(.9) within group (order by x) from unnest(rts) x));
    elsif game.kind='gonogo' then
      values_json:=values_json||jsonb_build_object('omissionRate',100.0*omissions/nullif(go_count,0),'commissionRate',100.0*commissions/nullif(no_go,0));
    end if;
  end if;
  if game.kind in ('pvt','choice','gonogo') then p_record:=jsonb_set(p_record,'{metrics}',values_json); end if;
  if values_json='{}'::jsonb then raise exception 'invalid_score'; end if;
  cid:=mind_lab_private.condition_id(p_game_id,game.version,rules);
  insert into public.ml_conditions(id,game_id,version,rules) values(cid,p_game_id,game.version,rules) on conflict do nothing;
  insert into public.ml_records(user_id,game_id,condition_id,client_id,ended_at,record)
    values(uid,p_game_id,cid,p_record->>'id',ended,p_record) on conflict do nothing returning id into rid;
  if rid is null then return jsonb_build_object('duplicate',true); end if;
  for score_item in select key,value from jsonb_each(values_json) where value <> 'null'::jsonb loop
    score_value:=score_item.value::float8;
    if score_value in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then raise exception 'invalid_score'; end if;
    lower_better:=score_item.key not in ('score','speed','accuracy');
    insert into public.ml_scores values(rid,uid,cid,score_item.key,score_value,lower_better,ended);
    insert into public.ml_bests(user_id,condition_id,metric,value,sort_value,record_id)
      values(uid,cid,score_item.key,score_value,case when lower_better then score_value else -score_value end,rid)
    on conflict(user_id,condition_id,metric) do update set value=excluded.value,sort_value=excluded.sort_value,record_id=excluded.record_id
      where excluded.sort_value < ml_bests.sort_value;
  end loop;
  update public.ml_board_revisions set revision=revision+1 where game_id=p_game_id;
  return jsonb_build_object('id',rid,'condition',cid);
end;
$$;

create or replace function mind_lab_private.histogram(vals double precision[]) returns jsonb
language sql immutable set search_path = '' as $$
  with bounds as (select min(x) lo,max(x) hi,count(*) n from unnest(vals) x),
  steps as (select *,case when lo=hi then 1 else (hi-lo)/10 end width from bounds),
  grouped as (select case when lo=hi then 0 else least(9,floor((x-lo)/width)::integer) end bucket,count(*) n
    from steps,unnest(vals) x group by 1),
  bars as (select i,lo+i*width low,case when lo=hi then hi else lo+(i+1)*width end high,coalesce(g.n,0) count
    from steps cross join lateral generate_series(0,case when lo=hi then 0 else 9 end) i
    left join grouped g on g.bucket=i where steps.n>0)
  select coalesce(jsonb_agg(jsonb_build_object('low',low,'high',high,'count',count) order by i),'[]') from bars;
$$;

create or replace function public.ml_dashboard(p_game_id text,p_version text,p_rules jsonb,p_metric text default 'score') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid text:=mind_lab_private.condition_id(p_game_id,p_version,p_rules); uid uuid:=auth.uid();
  population jsonb; personal jsonb; leaders jsonb; history jsonb; best_row public.ml_bests%rowtype; ranking bigint;
begin
  select * into best_row from public.ml_bests where user_id=uid and condition_id=cid and metric=p_metric;
  if found then select 1+count(*) into ranking from public.ml_bests where condition_id=cid and metric=p_metric and sort_value<best_row.sort_value; end if;
  select jsonb_build_object('count',count(*),'histogram',mind_lab_private.histogram(array_agg(value))) into population
    from public.ml_bests where condition_id=cid and metric=p_metric;
  select coalesce(jsonb_agg(to_jsonb(r) order by position,username),'[]') into leaders from
    (select rank() over(order by b.sort_value) position,p.username,b.value,b.user_id=uid is_self
      from public.ml_bests b join public.ml_profiles p on p.id=b.user_id
      where b.condition_id=cid and b.metric=p_metric order by b.sort_value,b.user_id limit 50) r;
  select jsonb_build_object('count',(select count(*) from public.ml_records where user_id=uid and condition_id=cid),'best',best_row.value,'rank',ranking,
    'histogram',mind_lab_private.histogram(array_agg(value)),
    'recentAverage',(select avg(s.value) from
      (select id from public.ml_records where user_id=uid and condition_id=cid order by ended_at desc,id desc limit 5) r
      left join public.ml_scores s on s.record_id=r.id and s.metric=p_metric))
    into personal from public.ml_scores where user_id=uid and condition_id=cid and metric=p_metric;
  select coalesce(jsonb_agg(to_jsonb(r) order by ended_at,record_id),'[]') into history from
    (select s.record_id::text,s.ended_at,s.value from
      (select id from public.ml_records where user_id=uid and condition_id=cid order by ended_at desc,id desc limit 60) recent
      join public.ml_scores s on s.record_id=recent.id and s.metric=p_metric) r;
  return jsonb_build_object('condition',cid,'population',population,'leaders',leaders,'personal',personal,'history',history);
end;
$$;

create or replace function public.ml_my_conditions(p_game_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]') from public.ml_conditions c
    where c.game_id=p_game_id and exists(select 1 from public.ml_records r where r.condition_id=c.id and r.user_id=auth.uid());
$$;

revoke all on all functions in schema mind_lab_private from public, anon, authenticated;
revoke all on function public.ml_submit(text,jsonb,uuid),public.ml_dashboard(text,text,jsonb,text),public.ml_my_conditions(text) from public, anon, authenticated;
grant execute on function public.ml_submit(text,jsonb,uuid) to authenticated;
grant execute on function public.ml_dashboard(text,text,jsonb,text) to anon, authenticated;
grant execute on function public.ml_my_conditions(text) to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ml_board_revisions') then
    alter publication supabase_realtime add table public.ml_board_revisions;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
