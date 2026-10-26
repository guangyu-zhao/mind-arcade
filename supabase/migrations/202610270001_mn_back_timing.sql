begin;

insert into public.ml_games(id, version, kind) values
  ('mn-back', 'mn-back-20261027', 'nback')
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
  window_ms := round((m+1)*1000.0/3);
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
    if exposure not between 400 and 525 or response not between window_ms and window_ms+125 then raise exception 'invalid_duration'; end if;
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

notify pgrst, 'reload schema';
commit;
