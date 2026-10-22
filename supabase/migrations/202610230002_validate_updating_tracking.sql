begin;

create or replace function mind_lab_private.valid_integer(value jsonb, minimum numeric, maximum numeric) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' then
    value::text::numeric between minimum and maximum and value::text::numeric = trunc(value::text::numeric)
    else false end;
$$;

create or replace function mind_lab_private.level_pass(game text, trial jsonb, rules jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  j jsonb; e jsonb; item jsonb; states jsonb; expected jsonb := '[]'; cells jsonb;
  i integer; n integer; p integer; q integer; side integer; channel integer; v integer; tail integer;
  lr boolean; tb boolean; answer text;
  counts integer[]; seen integer[]; event_index integer := 0;
  level_number integer; targets_count integer; balls_count integer; expected_speed numeric; expected_motion numeric;
  point jsonb; field text; running boolean;
begin
  if game in ('multiple-object-tracking','spatial-updating','arithmetic-updating','multi-stream-running-span') then
    if not mind_lab_private.valid_integer(trial->'level',1,2147483647)
      or jsonb_typeof(rules) is distinct from 'object' then raise exception 'invalid_trial'; end if;
    level_number := (trial->>'level')::integer;
  end if;
  if game = 'multiple-object-tracking' then
    if rules <> '{}'::jsonb then raise exception 'invalid_rules'; end if;
    targets_count := case when level_number<=2 then 1 when level_number<=5 then 2 when level_number<=8 then 3 when level_number<=11 then 4 else 5 end;
    balls_count := case when level_number<=2 then 6 when level_number<=5 then 8 when level_number<=8 then 10 else 12 end;
    expected_speed := case when level_number<=12 then (array[60,80,80,100,120,120,140,160,160,180,200,200])[level_number]
      when level_number<=24 then 200+(level_number-12)*10
      else round(320+80*ln(1+(level_number::numeric-24)/8)/ln(2::numeric),3) end;
    expected_motion := case when level_number<=12 then (array[4000,4000,4000,4000,4500,4500,4500,5000,5000,5000,5500,5500])[level_number]
      when level_number<=24 then 5500+ceil((level_number-12)::numeric/3)*500
      else 7500+(level_number::numeric-24)*500 end;
    if jsonb_typeof(trial->'targets') is distinct from 'array' or jsonb_typeof(trial->'selected') is distinct from 'array'
      or jsonb_typeof(trial->'initial') is distinct from 'array' or jsonb_typeof(trial->'final') is distinct from 'array'
      or jsonb_typeof(trial->'motionMs') is distinct from 'number' then raise exception 'invalid_trial'; end if;
    if jsonb_array_length(trial->'targets') <> targets_count or jsonb_array_length(trial->'selected') <> targets_count
      or jsonb_array_length(trial->'initial') <> balls_count or jsonb_array_length(trial->'final') <> balls_count
      or abs((trial->>'motionMs')::numeric-expected_motion)>125 then raise exception 'invalid_level_parameters'; end if;
    foreach field in array array['targets','selected'] loop
      if (select count(distinct value) from jsonb_array_elements(trial->field)) <> targets_count then raise exception 'invalid_selection'; end if;
      for item in select value from jsonb_array_elements(trial->field) loop
        if not mind_lab_private.valid_integer(item,0,balls_count-1) then raise exception 'invalid_selection'; end if;
      end loop;
    end loop;
    for point in select value from jsonb_array_elements((trial->'initial') || (trial->'final')) loop
      if jsonb_typeof(point->'x') is distinct from 'number' or jsonb_typeof(point->'y') is distinct from 'number' then raise exception 'invalid_position'; end if;
      if (point->>'x')::numeric not between 0 and 640 or (point->>'y')::numeric not between 0 and 480 then raise exception 'invalid_position'; end if;
    end loop;
    for point in select value from jsonb_array_elements(trial->'initial') loop
      if jsonb_typeof(point->'vx') is distinct from 'number' or jsonb_typeof(point->'vy') is distinct from 'number' then raise exception 'invalid_velocity'; end if;
      if abs(sqrt(power((point->>'vx')::numeric,2)+power((point->>'vy')::numeric,2))-expected_speed)>.01 then raise exception 'invalid_velocity'; end if;
    end loop;
    return (trial->'targets') @> (trial->'selected') and (trial->'selected') @> (trial->'targets');
  elsif game in ('spatial-updating','arithmetic-updating','multi-stream-running-span') then
    running := game='multi-stream-running-span';
    if not mind_lab_private.valid_integer(trial->'channels',1,2147483647)
      or not mind_lab_private.valid_integer(trial->'tail',1,case when running then 4 else 1 end)
      or jsonb_typeof(trial->'initial') is distinct from 'array'
      or jsonb_typeof(trial->'events') is distinct from 'array'
      or jsonb_typeof(trial->'responses') is distinct from 'array' then raise exception 'invalid_trial'; end if;
    n := (trial->>'channels')::integer; tail := (trial->>'tail')::integer;
    if n<>level_number or jsonb_array_length(trial->'responses')<>n
      or jsonb_array_length(trial->'initial')<>(case when running then 0 else n end) then raise exception 'invalid_length'; end if;
    if rules is distinct from (case when running then jsonb_build_object('tail',tail) else '{}'::jsonb end) then raise exception 'invalid_rules'; end if;
    for item in select value from jsonb_array_elements(trial->'initial') loop
      if not mind_lab_private.valid_integer(item,0,case when game='spatial-updating' then 8 else 9 end) then raise exception 'invalid_initial'; end if;
    end loop;
    for item in select value from jsonb_array_elements(trial->'responses') loop
      if jsonb_typeof(item) is distinct from 'array' then raise exception 'invalid_response'; end if;
      if jsonb_array_length(item)<>tail then raise exception 'invalid_length'; end if;
      for j in select value from jsonb_array_elements(item) loop
        if not mind_lab_private.valid_integer(j,case when game='arithmetic-updating' then -99 else 0 end,
          case when game='arithmetic-updating' then 99 when running then 9 else 8 end) then raise exception 'invalid_response'; end if;
      end loop;
    end loop;
    if (not running and jsonb_array_length(trial->'events')::bigint<>n::bigint*3)
      or (running and jsonb_array_length(trial->'events')::bigint<n::bigint*(tail+1)) then raise exception 'invalid_event_count'; end if;
    counts := array_fill(0,array[n]); seen := array[]::integer[];
    states := case when running then (select jsonb_agg('[]'::jsonb) from generate_series(1,n)) else trial->'initial' end;
    for e in select value from jsonb_array_elements(trial->'events') loop
      if not mind_lab_private.valid_integer(e->'channel',0,n-1) then raise exception 'invalid_channel'; end if;
      channel := (e->>'channel')::integer;
      counts[channel+1] := counts[channel+1]+1;
      if not running then
        if channel=any(seen) then raise exception 'invalid_update_sweep'; end if;
        seen := array_append(seen,channel);
        event_index := event_index+1;
        if mod(event_index,n)=0 then seen := array[]::integer[]; end if;
      end if;
      if not mind_lab_private.valid_integer(e->'value',case when game='arithmetic-updating' then -1 else 0 end,
        case when running then 9 when game='spatial-updating' then 3 else 1 end) then raise exception 'invalid_update'; end if;
      v := (e->>'value')::integer;
      if running then
        item := (states->channel) || to_jsonb(v);
        if jsonb_array_length(item)>tail then item := item-0; end if;
      elsif game='arithmetic-updating' then
        if v not in (-1,1) then raise exception 'invalid_update'; end if;
        item := to_jsonb((states->>channel)::integer+v);
      else
        p := (states->>channel)::integer;
        item := to_jsonb(case v when 0 then mod(p/3+2,3)*3+mod(p,3)
          when 1 then (p/3)*3+mod(p+1,3) when 2 then mod(p/3+1,3)*3+mod(p,3)
          else (p/3)*3+mod(p+2,3) end);
      end if;
      states := jsonb_set(states,array[channel::text],item);
    end loop;
    if exists(select 1 from unnest(counts) as event_counts(total) where case when running then total<tail+1 else total<>3 end) then raise exception 'invalid_event_count'; end if;
    if not running then select jsonb_agg(jsonb_build_array(value)) into states from jsonb_array_elements(states); end if;
    return states=trial->'responses';
  end if;
  if game not in ('rotation-span','symmetry-span','symmetry-span-plus-plus') then raise exception 'invalid_game'; end if;
  if jsonb_typeof(trial->'level') is distinct from 'number'
    or jsonb_typeof(trial->'judgments') is distinct from 'array'
    or jsonb_typeof(trial->'responses') is distinct from 'array' then raise exception 'invalid_trial'; end if;
  n := (trial->>'level')::integer;
  if n < 1 or jsonb_array_length(trial->'judgments') is distinct from n
    or jsonb_array_length(trial->'responses') is distinct from n then raise exception 'invalid_length'; end if;
  if game = 'rotation-span' then
    if jsonb_typeof(trial->'arrows') is distinct from 'array' then raise exception 'invalid_trial'; end if;
    if jsonb_array_length(trial->'arrows') is distinct from (trial->>'level')::integer then raise exception 'invalid_length'; end if;
    for item in select value from jsonb_array_elements((trial->'arrows') || (trial->'responses')) loop
      if jsonb_typeof(item) is distinct from 'number' or (item::text)::numeric not between 0 and 15
        or (item::text)::numeric <> trunc((item::text)::numeric) then raise exception 'invalid_arrow'; end if;
    end loop;
    for i in 1..jsonb_array_length(trial->'arrows')-1 loop
      if trial->'arrows'->i = trial->'arrows'->(i-1) then raise exception 'adjacent_repeat'; end if;
    end loop;
    for j in select value from jsonb_array_elements(trial->'judgments') loop
      if jsonb_typeof(j->'angle') is distinct from 'number' or jsonb_typeof(j->'letter') is distinct from 'string'
        or (j->>'angle')::numeric not in (45,90,135,180,225,270,315)
        or j->>'letter' not in ('Q','E','R','S','D','F','G','J','K','L','Z','C','B','N','P','2','3','4','5','7','@','%','&','?') then raise exception 'invalid_character'; end if;
      if jsonb_typeof(j->'mirrored') is distinct from 'boolean' or jsonb_typeof(j->'timedOut') is distinct from 'boolean'
        or jsonb_typeof(j->'response') is distinct from (case when (j->>'timedOut')::boolean then 'null' else 'boolean' end)
        then raise exception 'invalid_judgment'; end if;
    end loop;
    if trial->'arrows' <> trial->'responses' then return false; end if;
    for j in select value from jsonb_array_elements(trial->'judgments') loop
      if j->'response' is distinct from j->'mirrored' or (j->>'timedOut')::boolean then return false; end if;
    end loop;
    return true;
  end if;
  side := case when game = 'symmetry-span' then 4 else (rules->>'size')::integer end;
  if side is null or side not in (4,6) then raise exception 'invalid_size'; end if;
  if jsonb_typeof(trial->'positions') is distinct from 'array' then raise exception 'invalid_trial'; end if;
  n := jsonb_array_length(trial->'positions');
  if n is distinct from (trial->>'level')::integer then raise exception 'invalid_length'; end if;
  for item in select value from jsonb_array_elements((trial->'positions') || (trial->'responses')) loop
    if jsonb_typeof(item) is distinct from 'number' or (item::text)::numeric not between 0 and side*side-1
      or (item::text)::numeric <> trunc((item::text)::numeric) then raise exception 'invalid_position'; end if;
  end loop;
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
    if jsonb_typeof(j->'timedOut') is distinct from 'boolean'
      or jsonb_typeof(j->'response') is distinct from (case when (j->>'timedOut')::boolean then 'null' when game='symmetry-span' then 'boolean' else 'string' end)
      then raise exception 'invalid_judgment'; end if;
    if (j->>'timedOut')::boolean then return false; end if;
    lr := true; tb := true;
    if game = 'symmetry-span' then
      cells := j->'cells';
      if jsonb_typeof(cells) is distinct from 'array' then raise exception 'invalid_pattern'; end if;
      if jsonb_array_length(cells) <> 16 or exists(select 1 from jsonb_array_elements(cells) where jsonb_typeof(value) is distinct from 'boolean')
        then raise exception 'invalid_pattern'; end if;
      for p in 0..15 loop
        q := (p / 4)*4 + 3-mod(p,4);
        if cells->p <> cells->q then lr := false; end if;
      end loop;
      if j->'response' is distinct from to_jsonb(lr) then return false; end if;
    else
      if jsonb_typeof(j->'frames') is distinct from 'array' then raise exception 'invalid_pattern'; end if;
      if jsonb_array_length(j->'frames') not in (2,4,6) then raise exception 'invalid_pattern'; end if;
      select jsonb_agg(value->'target') into cells from jsonb_array_elements(j->'frames');
      if (select count(distinct value) from jsonb_array_elements(cells)) <> jsonb_array_length(cells) then raise exception 'invalid_pattern'; end if;
      for item in select value from jsonb_array_elements(cells) loop
        if jsonb_typeof(item) is distinct from 'number' or (item::text)::numeric not between 0 and side*side-1
          or (item::text)::numeric <> trunc((item::text)::numeric) then raise exception 'invalid_position'; end if;
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

notify pgrst, 'reload schema';
commit;
