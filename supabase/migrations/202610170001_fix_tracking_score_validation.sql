begin;

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

notify pgrst, 'reload schema';
commit;
