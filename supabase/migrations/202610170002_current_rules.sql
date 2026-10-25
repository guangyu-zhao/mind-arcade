-- Replaces the scoring rules and clears all previous scores. Accounts are kept.
begin;

delete from public.ml_records r using public.ml_conditions c
  where r.condition_id=c.id and c.version<>'arcade-20261017';
delete from public.ml_conditions where version<>'arcade-20261017';
drop function if exists public.ml_my_conditions(text);
drop table if exists public.ml_bests;

insert into public.ml_games(id, version, kind) values
  ('sequence-memory', 'arcade-20261017', 'span'),
  ('letter-number-sequencing', 'arcade-20261017', 'span'),
  ('picture-span', 'arcade-20261017', 'span'),
  ('symbol-span', 'arcade-20261017', 'span'),
  ('symmetry-span', 'arcade-20261017', 'levels'),
  ('rotation-span', 'arcade-20261017', 'levels'),
  ('symmetry-span-plus-plus', 'arcade-20261017', 'levels'),
  ('spatial-updating', 'arcade-20261017', 'levels'),
  ('arithmetic-updating', 'arcade-20261017', 'levels'),
  ('multi-stream-running-span', 'arcade-20261017', 'levels'),
  ('symbol-search', 'arcade-20261017', 'speed'),
  ('digit-symbol-coding', 'arcade-20261017', 'speed'),
  ('pattern-comparison', 'arcade-20261017', 'speed'),
  ('target-cancellation', 'arcade-20261017', 'speed'),
  ('choice-reaction', 'arcade-20261017', 'choice'),
  ('schulte-table', 'arcade-20261017', 'schulte'),
  ('multiple-object-tracking', 'arcade-20261017', 'levels'),
  ('psychomotor-vigilance', 'arcade-20261017', 'pvt'),
  ('flanker', 'arcade-20261017', 'control'),
  ('stroop', 'arcade-20261017', 'control'),
  ('go-no-go', 'arcade-20261017', 'gonogo')
on conflict(id) do update set version=excluded.version, kind=excluded.kind;

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
      and (trial->'targets') @> (trial->'selected') and (trial->'selected') @> (trial->'targets');
  elsif game in ('spatial-updating', 'arithmetic-updating', 'multi-stream-running-span') then
    n := (trial->>'channels')::integer; tail := (trial->>'tail')::integer;
    if n < 1 or n is distinct from (trial->>'level')::integer or tail not between 1 and 4 or jsonb_array_length(trial->'responses') <> n then raise exception 'invalid_trial'; end if;
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
    if jsonb_array_length(trial->'arrows') is distinct from (trial->>'level')::integer then raise exception 'invalid_length'; end if;
    for i in 1..jsonb_array_length(trial->'arrows')-1 loop
      if trial->'arrows'->i = trial->'arrows'->(i-1) then raise exception 'adjacent_repeat'; end if;
    end loop;
    for j in select value from jsonb_array_elements(trial->'judgments') loop
      if (j->>'angle')::integer not in (45,90,135,180,225,270,315)
        or j->>'letter' not in ('Q','E','R','S','D','F','G','J','K','L','Z','C','B','N','P','2','3','4','5','7','@','%','&') then raise exception 'invalid_character'; end if;
    end loop;
    if trial->'arrows' <> trial->'responses' then return false; end if;
    for j in select value from jsonb_array_elements(trial->'judgments') loop
      if j->'response' is distinct from j->'mirrored' or (j->>'timedOut')::boolean then return false; end if;
    end loop;
    return true;
  end if;
  side := case when game = 'symmetry-span' then 4 else (rules->>'size')::integer end;
  if side not in (4,6) then raise exception 'invalid_size'; end if;
  n := jsonb_array_length(trial->'positions');
  if n is distinct from (trial->>'level')::integer then raise exception 'invalid_length'; end if;
  for i in 1..n-1 loop
    if trial->'positions'->i = trial->'positions'->(i-1) then raise exception 'adjacent_repeat'; end if;
  end loop;
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
  ended timestamptz; elapsed_ms double precision; reason text; score_value integer := 0;
  lev integer := 1; lives integer := 3; passed boolean; t jsonb; previous_end double precision := 0;
  target integer; answer integer; rt double precision; errors integer := 0;
  window_ms integer; required_keys integer; wrong integer; missed integer;
begin
  if uid is null or uid is distinct from p_owner then raise exception 'authentication_required' using errcode='28000'; end if;
  if jsonb_typeof(p_record) is distinct from 'object' or octet_length(p_record::text)>2000000
    or coalesce(p_record->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'invalid_record'; end if;
  select * into game from public.ml_games where id=p_game_id;
  if not found or p_record#>>'{meta,rulesVersion}' is distinct from game.version then raise exception 'unsupported_rules'; end if;
  rules:=p_record#>'{meta,rules}';
  if jsonb_typeof(rules) is distinct from 'object' or octet_length(rules::text)>2000 then raise exception 'invalid_rules'; end if;
  ended:=(p_record->>'endedAt')::timestamptz;
  if ended is null or ended>now()+interval '10 minutes' or ended<timestamptz '2020-01-01' then raise exception 'invalid_date'; end if;
  elapsed_ms:=(p_record->>'elapsedMs')::double precision;
  if elapsed_ms is null or elapsed_ms<0 or elapsed_ms in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) then raise exception 'invalid_duration'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select id into rid from public.ml_records where user_id=uid and game_id=p_game_id and client_id=p_record->>'id';
  if found then return jsonb_build_object('id',rid,'duplicate',true); end if;
  if (select count(*) from public.ml_records where user_id=uid and created_at>now()-interval '1 minute')>=60 then raise exception 'rate_limited'; end if;
  reason:=p_record->>'reason';

  if game.kind='span' then
    if reason is null or reason not in ('mistake','stopped','complete') then raise exception 'invalid_ending'; end if;
    if p_game_id='sequence-memory' then
      required_keys:=3;
      if coalesce((rules->>'size')::integer,0) not between 3 and 7 or coalesce(rules->>'mode','') not in ('prefix','random')
        or coalesce(rules->>'order','') not in ('forward','reverse') then raise exception 'invalid_rules'; end if;
    elsif p_game_id='letter-number-sequencing' then required_keys:=0;
    else
      required_keys:=1;
      if coalesce(rules->>'order','') not in ('forward','reverse') then raise exception 'invalid_rules'; end if;
    end if;
    if (select count(*) from jsonb_object_keys(rules))<>required_keys then raise exception 'invalid_rules'; end if;
    score_value:=(p_record->>'score')::integer;
  elsif game.kind='levels' then
    if coalesce(p_record->>'status','') not in ('complete','stopped')
      or jsonb_typeof(p_record->'trials') is distinct from 'array' or jsonb_array_length(p_record->'trials')<1 then raise exception 'incomplete_session'; end if;
    for t in select value from jsonb_array_elements(p_record->'trials') loop
      if lives=0 or (t->>'level')::integer is distinct from lev then raise exception 'invalid_progression'; end if;
      passed:=mind_lab_private.level_pass(p_game_id,t,rules);
      if passed is null then raise exception 'invalid_trial'; end if;
      if passed then lev:=lev+1; else lives:=lives-1; end if;
    end loop;
    score_value:=lev-1;
    if (p_record->>'lives')::integer is distinct from lives or (reason='lives' and lives<>0) then raise exception 'invalid_ending'; end if;
  else
    if elapsed_ms>30000 or reason is null or reason not in ('error','missed','timeout')
      or (reason='timeout' and elapsed_ms<>30000) then raise exception 'invalid_ending'; end if;
    if game.kind='speed' then
      if p_record->>'duration' is distinct from '30' or rules->>'duration' is distinct from '30'
        or coalesce(rules->>'kind','') <> (case p_game_id when 'symbol-search' then 'search' when 'digit-symbol-coding' then 'coding' when 'pattern-comparison' then 'comparison' else 'cancellation' end) then raise exception 'invalid_rules'; end if;
      score_value:=(p_record->>'correct')::integer; wrong:=(p_record->>'wrong')::integer; missed:=(p_record->>'missed')::integer;
      if wrong is null or missed is null or wrong not between 0 and 1 or missed not between 0 and 10
        or (reason='error' and (wrong<>1 or missed<>0)) or (reason='missed' and (missed=0 or wrong<>0))
        or (reason='timeout' and (wrong<>0 or missed<>0))
        or (p_game_id<>'target-cancellation' and (missed<>0 or reason='missed')) then raise exception 'invalid_score'; end if;
    else
      if p_record->>'durationMs' is distinct from '30000' or rules->>'durationMs' is distinct from '30000' or reason='missed' then raise exception 'invalid_duration'; end if;
      if game.kind='schulte' then
        if coalesce((rules->>'size')::integer,0) not between 5 and 9 or coalesce(rules->>'direction','') not in ('asc','desc')
          or jsonb_typeof(rules->'disappear') is distinct from 'boolean' then raise exception 'invalid_rules'; end if;
        score_value:=(p_record->>'score')::integer;
      else
        if jsonb_typeof(p_record->'trials') is distinct from 'array' then raise exception 'invalid_trial'; end if;
        if game.kind in ('pvt','choice','gonogo') and (p_record->>'kind' is distinct from game.kind or rules->>'kind' is distinct from game.kind) then raise exception 'invalid_rules'; end if;
        window_ms:=case when game.kind='pvt' then 10000 else 1500 end;
        for t in select value from jsonb_array_elements(p_record->'trials') loop
          if errors>0 or (t->>'onsetMs')::float8 is null or (t->>'onsetMs')::float8<previous_end-.1 then raise exception 'invalid_trial'; end if;
          target:=(t->>'target')::integer; answer:=(t->>'answer')::integer; rt:=(t->>'rtMs')::float8;
          if target is null or target<0 or target>(case when p_game_id='stroop' then 3 when game.kind='pvt' then 0 else 1 end) then raise exception 'invalid_target'; end if;
          if game.kind='control' then
            if answer is null or rt is null or rt<0 then raise exception 'invalid_trial'; end if;
            previous_end:=(t->>'onsetMs')::float8+rt;
            passed:=answer=target;
          else
            if (answer is null)<>(rt is null) or (rt is not null and (rt<0 or rt>window_ms)) then raise exception 'invalid_trial'; end if;
            previous_end:=(t->>'onsetMs')::float8+coalesce(rt,window_ms);
            if (t->>'endMs')::float8 is null or abs((t->>'endMs')::float8-previous_end)>.1 then raise exception 'invalid_duration'; end if;
            passed:=case when game.kind='gonogo' and target=1 then answer is null else answer=target and rt>=100 end;
          end if;
          if previous_end>elapsed_ms+.1 then raise exception 'invalid_duration'; end if;
          if coalesce(passed,false) then score_value:=score_value+1; else errors:=errors+1; end if;
        end loop;
        if game.kind<>'control' then
          if jsonb_typeof(p_record->'early') is distinct from 'array' or jsonb_array_length(p_record->'early')>1 then raise exception 'invalid_trial'; end if;
          if jsonb_array_length(p_record->'early')=1 then
            if errors>0 or (p_record->'early'->>0)::float8<previous_end-.1 or (p_record->'early'->>0)::float8>elapsed_ms then raise exception 'invalid_trial'; end if;
            errors:=errors+1;
          end if;
        end if;
        if errors<>(case when reason='error' then 1 else 0 end) then raise exception 'invalid_ending'; end if;
      end if;
    end if;
  end if;
  if score_value is null or score_value<0 or jsonb_typeof(p_record->'score') is distinct from 'number'
    or (p_record->>'score')::float8<>score_value then raise exception 'invalid_score'; end if;
  cid:=mind_lab_private.condition_id(p_game_id,game.version,rules);
  insert into public.ml_conditions(id,game_id,version,rules) values(cid,p_game_id,game.version,rules) on conflict do nothing;
  insert into public.ml_records(user_id,game_id,condition_id,client_id,ended_at,record)
    values(uid,p_game_id,cid,p_record->>'id',ended,p_record) returning id into rid;
  insert into public.ml_scores(record_id,user_id,condition_id,metric,value,lower_is_better,ended_at)
    values(rid,uid,cid,'score',score_value,false,ended);
  update public.ml_board_revisions set revision=revision+1 where game_id=p_game_id;
  return jsonb_build_object('id',rid,'condition',cid);
end;
$$;

create or replace function public.ml_dashboard(p_game_id text,p_version text,p_rules jsonb,p_metric text default 'score') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid text; uid uuid:=auth.uid(); population jsonb; personal jsonb; history jsonb;
begin
  if p_metric<>'score' or not exists(select 1 from public.ml_games where id=p_game_id and version=p_version) then raise exception 'unsupported_rules'; end if;
  cid:=mind_lab_private.condition_id(p_game_id,p_version,p_rules);
  select jsonb_build_object('histogram',mind_lab_private.histogram(array_agg(value))) into population
    from public.ml_scores where condition_id=cid and metric='score';
  select jsonb_build_object('histogram',mind_lab_private.histogram(array_agg(value))),
    coalesce(jsonb_agg(jsonb_build_object('ended_at',ended_at,'value',value) order by ended_at,record_id),'[]'::jsonb)
    into personal,history from public.ml_scores where user_id=uid and condition_id=cid and metric='score';
  return jsonb_build_object('population',population,'personal',personal,'history',history);
end;
$$;

update public.ml_board_revisions set revision=revision+1;
notify pgrst, 'reload schema';
commit;
