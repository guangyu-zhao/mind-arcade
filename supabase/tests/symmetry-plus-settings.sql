begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.symmetry_trial(rules jsonb) returns jsonb
language plpgsql as $$
declare
  side integer := (rules->>'size')::integer;
  count integer := case when rules->>'flashCount'='random' then 6 else (rules->>'flashCount')::integer end;
  frames jsonb := '[]'; responses jsonb := '[]';
  i integer; p integer; q integer;
begin
  for i in 0..count-1 loop
    p := (i/2)*side + case when mod(i,2)=0 then 0 else side-1 end;
    frames := frames || jsonb_build_object('target',p,'distractor',
      case when (rules->>'symmetryInterference')::boolean then mod(p+1,side*side) else null end);
  end loop;
  for i in 0..1 loop
    p := case when rules->>'order'='reverse' then 1-i else i end;
    q := case rules->>'transform'
      when 'rotated' then mod(p,side)*side+side-1-p/side
      when 'counterclockwise' then (side-1-mod(p,side))*side+p/side
      else p end;
    responses := responses || to_jsonb(q);
  end loop;
  return jsonb_build_object('level',2,'positions','[0,1]'::jsonb,'responses',responses,
    'targetColor','blue','distractorColor','orange','rules',rules,
    'memoryDistractors',case when (rules->>'sequenceInterference')::boolean then '[1,0]'::jsonb else '[null,null]'::jsonb end,
    'judgments',jsonb_build_array(
      jsonb_build_object('frames',frames,'response','left-right','timedOut',false),
      jsonb_build_object('frames',frames,'response','left-right','timedOut',false)));
end;
$$;

select is(mind_lab_private.level_pass('symmetry-span-plus-plus',pg_temp.symmetry_trial(rules),rules),true,
  'accepts settings ' || rules::text)
from (
  select jsonb_build_object('size',side,'flashCount',count,'symmetryInterference',symmetry,
    'sequenceInterference',sequence,'order',recall_order,'transform',transform) as rules
  from unnest(array[4,6]) as side
  cross join unnest(array['2'::jsonb,'4'::jsonb,'6'::jsonb,'"random"'::jsonb]) as count
  cross join unnest(array[false,true]) as symmetry
  cross join unnest(array[false,true]) as sequence
  cross join unnest(array['forward','reverse']) as recall_order
  cross join unnest(array['original','rotated','counterclockwise']) as transform
) as variants;

create temporary table fixture as
select rules,pg_temp.symmetry_trial(rules) as trial from (
  select '{"size":4,"flashCount":6,"symmetryInterference":true,"sequenceInterference":true,"order":"forward","transform":"original"}'::jsonb as rules
) as settings;

select is(mind_lab_private.level_pass('symmetry-span-plus-plus',
  jsonb_set(jsonb_set(trial,'{rules,flashCount}','"random"'),'{judgments,1,frames}',
    (select jsonb_agg(value) from jsonb_array_elements(trial->'judgments'->1->'frames') with ordinality where ordinality<=length)),
  jsonb_set(rules,'{flashCount}','"random"')),true,'random mode accepts a new length of ' || length || ' in the same trial')
from fixture cross join unnest(array[2,4,6]) as length;

select throws_ok(format('select mind_lab_private.level_pass(%L,%L,%L)',
  'symmetry-span-plus-plus',jsonb_set(jsonb_set(trial,'{rules,flashCount}','2'),'{responses}','[2,3]'),
  jsonb_set(rules,'{flashCount}','2')),'P0001','invalid_pattern_length',
  'fixed count cannot accept six flashes even when recall is wrong') from fixture;

select throws_ok(format('select mind_lab_private.level_pass(%L,%L,%L)',
  'symmetry-span-plus-plus',trial,jsonb_set(rules,path,value)),
  'P0001','invalid_rules',description)
from fixture cross join (values
  (array['size'],'5'::jsonb,'rejects an unsupported grid'),
  (array['flashCount'],'3'::jsonb,'rejects an unsupported count'),
  (array['flashCount'],'null'::jsonb,'rejects a null count'),
  (array['symmetryInterference'],'"true"'::jsonb,'rejects a non-boolean switch'),
  (array['order'],'"other"'::jsonb,'rejects an unknown recall order'),
  (array['transform'],'null'::jsonb,'rejects a missing transform'),
  (array['extra'],'1'::jsonb,'rejects extra settings')
) as invalid(path,value,description);

select throws_ok(format('select mind_lab_private.level_pass(%L,%L,%L)',
  'symmetry-span-plus-plus',jsonb_set(trial,'{rules,size}','6'),rules),
  'P0001','invalid_rules','trial settings must match the session') from fixture;
select throws_ok(format('select mind_lab_private.level_pass(%L,%L,%L)',
  'symmetry-span-plus-plus',trial,rules-'order'),
  'P0001','invalid_rules','rejects a missing rule') from fixture;

select throws_ok(format('select mind_lab_private.level_pass(%L,%L,%L)',
  'symmetry-span-plus-plus',jsonb_set(trial,path,value),rules),
  'P0001',error,description)
from fixture cross join (values
  (array['memoryDistractors'],'[]'::jsonb,'invalid_length','requires one memory distractor per item'),
  (array['memoryDistractors','0'],'null'::jsonb,'invalid_memory_distractor','requires enabled memory interference'),
  (array['memoryDistractors','0'],'0'::jsonb,'invalid_memory_distractor','memory distractor cannot cover the target'),
  (array['memoryDistractors','0'],'16'::jsonb,'invalid_memory_distractor','memory distractor must be on the grid'),
  (array['judgments','0','frames','0','distractor'],'null'::jsonb,'invalid_symmetry_distractor','requires enabled symmetry interference'),
  (array['judgments','0','frames','0','distractor'],'0'::jsonb,'invalid_symmetry_distractor','symmetry distractor cannot cover the target'),
  (array['judgments','0','frames','0','distractor'],'16'::jsonb,'invalid_symmetry_distractor','symmetry distractor must be on the grid'),
  (array['judgments','0','frames','0','distractor'],'4'::jsonb,'invalid_symmetry_distractor','symmetry distractors cannot repeat'),
  (array['judgments','0','frames','0','target'],'3'::jsonb,'invalid_pattern','targets cannot repeat'),
  (array['judgments','1','response'],'"both"'::jsonb,'invalid_judgment','rejects invalid judgment answers'),
  (array['judgments','1','timedOut'],'true'::jsonb,'invalid_judgment','timeout must have a null answer'),
  (array['targetColor'],'"black"'::jsonb,'invalid_color','rejects an unknown color'),
  (array['distractorColor'],'"blue"'::jsonb,'invalid_color','requires two different colors')
) as invalid(path,value,error,description);

select throws_ok(format('select mind_lab_private.level_pass(%L,%L,%L)',
  'symmetry-span-plus-plus',jsonb_set(jsonb_set(trial,'{rules}',rules || switches),'{responses}','[2,3]'),rules || switches),
  'P0001',error,description)
from fixture cross join (values
  ('{"sequenceInterference":false}'::jsonb,'invalid_memory_distractor','disabled memory interference must not contain distractors'),
  ('{"symmetryInterference":false}'::jsonb,'invalid_symmetry_distractor','disabled symmetry interference must not contain distractors')
) as invalid(switches,error,description);

select is(mind_lab_private.level_pass('symmetry-span-plus-plus',jsonb_set(trial,'{responses}','[2,3]'),rules),
  false,'an ordinary recall error remains a valid failed trial') from fixture;
select is(mind_lab_private.level_pass('symmetry-span-plus-plus',
  jsonb_set(jsonb_set(trial,'{judgments,0,timedOut}','true'),'{judgments,0,response}','null'),rules),
  false,'a valid judgment timeout remains a failed trial') from fixture;

select * from finish();
rollback;
