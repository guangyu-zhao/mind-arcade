begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.nback_record(rules jsonb) returns jsonb
language plpgsql as $$
declare
  channels text[] := array['position']; channel text; trials jsonb := '[]'; stimulus jsonb; responses jsonb;
  i integer; n integer := (rules->>'n')::integer; side integer := (rules->>'size')::integer; v integer; limit_value integer;
begin
  foreach channel in array array['sound','shape','color'] loop
    if (rules->>channel)::boolean then channels := array_append(channels,channel); end if;
  end loop;
  for i in 0..n+29 loop
    stimulus := '{"position":null,"sound":null,"shape":null,"color":null}'; responses := '[]';
    foreach channel in array channels loop
      limit_value := case channel when 'position' then side*side when 'sound' then 26 when 'shape' then 9 else 8 end;
      v := case when i<n then mod(i,limit_value) else (trials->(i-n)->'stimulus'->>channel)::integer end;
      if i>=n and i<n+9 then responses := responses || to_jsonb(channel);
      elsif i>=n then v := mod(v+1,limit_value); end if;
      stimulus := jsonb_set(stimulus,array[channel],to_jsonb(v));
    end loop;
    trials := trials || jsonb_build_object('stimulus',stimulus,'responses',responses,'exposureMs',400,'responseMs',round((cardinality(channels)+1)*1000.0/3));
  end loop;
  return jsonb_build_object('id','nback-test','endedAt',now(),'meta',jsonb_build_object('rulesVersion','mn-back-20261027','rules',rules),
    'reason','complete','score',100,'elapsedMs',(n+30)*(400+round((cardinality(channels)+1)*1000.0/3)),'trials',trials);
end;
$$;

select is(mind_lab_private.mn_back_score(pg_temp.nback_record(rules),rules),100::numeric,'accepts variant ' || rules::text)
from (select jsonb_build_object('size',side,'n',n,'sound',sound,'shape',shape,'color',color) as rules
  from generate_series(3,7) as side cross join generate_series(1,6) as n
  cross join unnest(array[false,true]) as sound cross join unnest(array[false,true]) as shape cross join unnest(array[false,true]) as color) as variants;

create temporary table fixture as select rules,pg_temp.nback_record(rules) as record
from (select '{"size":3,"n":1,"sound":false,"shape":false,"color":false}'::jsonb as rules) as setting;

select is(mind_lab_private.mn_back_score(jsonb_set(record,'{trials}',
  (select jsonb_agg(jsonb_set(value,'{responses}','[]')) from jsonb_array_elements(record->'trials'))),rules),0::numeric,'no answers score zero') from fixture;
select is(mind_lab_private.mn_back_score(jsonb_set(record,'{trials}',
  (select jsonb_agg(case when ordinality=1 then value else jsonb_set(value,'{responses}','["position"]') end order by ordinality)
    from jsonb_array_elements(record->'trials') with ordinality)),rules),46.15::numeric,'selecting everything includes false alarms') from fixture;
select is(mind_lab_private.mn_back_score(jsonb_set(record,'{trials,1,responses}','[]'),rules),94.12::numeric,'one missed match lowers F1') from fixture;
select is(mind_lab_private.mn_back_score(jsonb_set(record,'{trials,10,responses}','["position"]'),rules),94.74::numeric,'one false alarm lowers F1') from fixture;

select throws_ok(format('select mind_lab_private.mn_back_score(%L,%L)',record,jsonb_set(rules,path,value)),
  'P0001','invalid_rules',description)
from fixture cross join (values
  (array['size'],'2'::jsonb,'rejects small grid'), (array['size'],'8'::jsonb,'rejects large grid'),
  (array['n'],'0'::jsonb,'rejects zero N'), (array['n'],'7'::jsonb,'rejects N above six'),
  (array['n'],'1.5'::jsonb,'rejects fractional N'), (array['sound'],'"true"'::jsonb,'rejects non-boolean channel'),
  (array['position'],'false'::jsonb,'position cannot be disabled')) as invalid(path,value,description);

select throws_ok(format('select mind_lab_private.mn_back_score(%L,%L)',jsonb_set(record,path,value),rules),
  'P0001',error,description)
from fixture cross join (values
  (array['reason'],'"stopped"'::jsonb,'incomplete_session','canceled games cannot be saved'),
  (array['trials'],'[]'::jsonb,'incomplete_session','all N+30 stimuli are required'),
  (array['trials','0','responses'],'["position"]'::jsonb,'invalid_trial','warm-up cannot have an answer'),
  (array['trials','1','responses'],'["sound"]'::jsonb,'invalid_trial','disabled channel cannot be selected'),
  (array['trials','1','responses'],'["position","position"]'::jsonb,'invalid_trial','responses cannot repeat'),
  (array['trials','1','responses'],'[1]'::jsonb,'invalid_trial','channel must be a string'),
  (array['trials','1','stimulus','position'],'9'::jsonb,'invalid_trial','position must be on the board'),
  (array['trials','1','stimulus','color'],'0'::jsonb,'invalid_trial','inactive stimulus must be null'),
  (array['trials','1','stimulus','position'],'1'::jsonb,'invalid_targets','cannot change the target frequency'),
  (array['trials','1','exposureMs'],'399'::jsonb,'invalid_duration','stimulus must be shown for 400 milliseconds'),
  (array['trials','1','exposureMs'],'526'::jsonb,'invalid_duration','overlong stimulus cannot be saved'),
  (array['trials','1','exposureMs'],'1000'::jsonb,'invalid_duration','old one-second timing is rejected'),
  (array['trials','1','responseMs'],'666'::jsonb,'invalid_duration','full response window is required'),
  (array['trials','1','responseMs'],'793'::jsonb,'invalid_duration','interrupted timer cannot be saved'),
  (array['trials','1','responseMs'],'null'::jsonb,'invalid_duration','duration cannot be null'),
  (array['elapsedMs'],'1'::jsonb,'invalid_duration','total time must match trials')) as invalid(path,value,error,description);

select ok(not has_function_privilege('anon','mind_lab_private.mn_back_score(jsonb,jsonb)','EXECUTE'),'validation helper is private');
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000031',encode(sha256(convert_to('nback-alice','UTF8')),'hex')||'@users.mind-lab.invalid','{"username":"Nback-Alice"}');
grant select on fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000031',true);
select lives_ok(format('select public.ml_submit(%L,%L,%L)','mn-back',
  jsonb_set(jsonb_set(record,'{trials,1,responses}','[]'),'{score}','94.12'),'00000000-0000-4000-8000-000000000031'),'accepts fractional F1 through the public endpoint') from fixture;
select is((public.ml_dashboard('mn-back','mn-back-20261027',rules,'score')->'history'->0->>'value')::numeric,94.12::numeric,'dashboard preserves fractional F1') from fixture;
select is(jsonb_array_length(public.ml_dashboard('mn-back','mn-back-20261027',jsonb_set(rules,'{n}','2'),'score')->'history'),0,'another N has separate statistics') from fixture;
select throws_ok(format('select public.ml_submit(%L,%L,%L)','mn-back',jsonb_set(jsonb_set(record,'{id}','"forged-score"'),'{score}','99.99'),
  '00000000-0000-4000-8000-000000000031'),'P0001','invalid_score','server recomputes F1 instead of trusting the submitted score') from fixture;
reset role;
select is((select revision::integer from public.ml_board_revisions where game_id='mn-back'),1,'a saved game triggers real-time statistics refresh');
select * from finish();
rollback;
