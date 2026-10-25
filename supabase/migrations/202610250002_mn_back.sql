begin;

insert into public.ml_games(id, version, kind) values
  ('mn-back', 'mn-back-20261025', 'nback')
on conflict(id) do update set version=excluded.version, kind=excluded.kind;
insert into public.ml_board_revisions(game_id) values ('mn-back') on conflict do nothing;

create or replace function mind_lab_private.mn_back_score(record jsonb, rules jsonb) returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  side integer; n integer; m integer := 1; i integer; c integer; channel text; limit_value integer;
  channels text[] := array['position']; all_channels text[] := array['position','sound','shape','color'];
  matches integer[] := array[0,0,0,0]; hits integer := 0; false_alarms integer := 0; misses integer := 0;
  trial jsonb; stimulus jsonb; selected boolean; matched boolean; duration float8 := 0;
  exposure float8; response float8; window_ms integer; denominator integer;
begin
  if jsonb_typeof(rules) is distinct from 'object' then raise exception 'invalid_rules'; end if;
  if (select count(*) from jsonb_object_keys(rules))<>5
    or not mind_lab_private.valid_integer(rules->'size',3,7)
    or not mind_lab_private.valid_integer(rules->'n',1,6)
    or jsonb_typeof(rules->'sound') is distinct from 'boolean'
    or jsonb_typeof(rules->'shape') is distinct from 'boolean'
    or jsonb_typeof(rules->'color') is distinct from 'boolean' then raise exception 'invalid_rules'; end if;
  side := (rules->>'size')::integer; n := (rules->>'n')::integer;
  foreach channel in array array['sound','shape','color'] loop
    if (rules->>channel)::boolean then channels := array_append(channels,channel); m := m+1; end if;
  end loop;
  window_ms := m*1000+500;
  if record->>'reason' is distinct from 'complete' or jsonb_typeof(record->'trials') is distinct from 'array' then raise exception 'incomplete_session'; end if;
  if jsonb_array_length(record->'trials')<>n+30 then raise exception 'incomplete_session'; end if;
  for i in 0..n+29 loop
    trial := record->'trials'->i; stimulus := trial->'stimulus';
    if jsonb_typeof(stimulus) is distinct from 'object' or jsonb_typeof(trial->'responses') is distinct from 'array' then raise exception 'invalid_trial'; end if;
    if (select count(*) from jsonb_object_keys(stimulus))<>4
      or jsonb_array_length(trial->'responses')>m
      or (select count(distinct value) from jsonb_array_elements(trial->'responses'))<>jsonb_array_length(trial->'responses')
      or (i<n and jsonb_array_length(trial->'responses')<>0) then raise exception 'invalid_trial'; end if;
    if exists(select 1 from jsonb_array_elements(trial->'responses') as r(value)
      where jsonb_typeof(value)<>'string' or not (value #>> '{}') = any(channels)) then raise exception 'invalid_trial'; end if;
    for c in 1..4 loop
      channel := all_channels[c];
      if channel = any(channels) then
        limit_value := case channel when 'position' then side*side-1 when 'sound' then 25 when 'shape' then 8 else 7 end;
        if not mind_lab_private.valid_integer(stimulus->channel,0,limit_value) then raise exception 'invalid_trial'; end if;
        if i>=n then
          matched := stimulus->channel = record->'trials'->(i-n)->'stimulus'->channel;
          selected := trial->'responses' ? channel;
          if matched then
            matches[c] := matches[c]+1;
            if selected then hits := hits+1; else misses := misses+1; end if;
          elsif selected then false_alarms := false_alarms+1; end if;
        end if;
      elsif stimulus->channel is distinct from 'null'::jsonb then raise exception 'invalid_trial'; end if;
    end loop;
    if jsonb_typeof(trial->'exposureMs') is distinct from 'number' or jsonb_typeof(trial->'responseMs') is distinct from 'number' then raise exception 'invalid_duration'; end if;
    exposure := (trial->>'exposureMs')::float8; response := (trial->>'responseMs')::float8;
    if exposure not between 1000 and 1125 or response not between window_ms and window_ms+125 then raise exception 'invalid_duration'; end if;
    duration := duration+exposure+response;
  end loop;
  for c in 1..4 loop
    if all_channels[c] = any(channels) and matches[c]<>9 then raise exception 'invalid_targets'; end if;
  end loop;
  if jsonb_typeof(record->'elapsedMs') is distinct from 'number' or abs((record->>'elapsedMs')::float8-duration)>1 then raise exception 'invalid_duration'; end if;
  denominator := 2*hits+false_alarms+misses;
  return case when denominator=0 then 0 else round(200.0*hits/denominator,2) end;
end;
$$;
revoke all on function mind_lab_private.mn_back_score(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.ml_submit(p_game_id text, p_record jsonb, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); game public.ml_games%rowtype; cid text; rid bigint; rules jsonb;
  ended timestamptz; elapsed_ms double precision; reason text; score_value numeric := 0;
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
  elsif game.kind='nback' then
    score_value := mind_lab_private.mn_back_score(p_record,rules);
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
    or (p_record->>'score')::numeric<>score_value then raise exception 'invalid_score'; end if;
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

notify pgrst, 'reload schema';
commit;
