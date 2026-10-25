begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000011',encode(sha256(convert_to('population-alice','UTF8')),'hex')||'@users.mind-lab.invalid','{"username":"Population-Alice"}'),
 ('00000000-0000-4000-8000-000000000012',encode(sha256(convert_to('population-bob','UTF8')),'hex')||'@users.mind-lab.invalid','{"username":"Population-Bob"}');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
do $$
begin
  for i in 0..5 loop
    perform public.ml_submit('schulte-table',jsonb_build_object(
      'id','population-alice-'||i,'endedAt',now()-make_interval(mins=>6-i),
      'elapsedMs',25000,'durationMs',30000,'reason','error','score',case when i=0 then 100 else i*2 end,
      'meta',jsonb_build_object('rulesVersion','arcade-20261017','rules','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}'::jsonb)),
      '00000000-0000-4000-8000-000000000011');
  end loop;
  perform public.ml_submit('schulte-table',jsonb_build_object(
    'id','population-other-variant','endedAt',now(),'elapsedMs',25000,'durationMs',30000,'reason','error','score',900,
    'meta',jsonb_build_object('rulesVersion','arcade-20261017','rules','{"size":6,"direction":"asc","disappear":false,"durationMs":30000}'::jsonb)),
    '00000000-0000-4000-8000-000000000011');
end;
$$;
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')->'history'),6,'personal history retains every run');
select is((select sum((bin->>'count')::integer)::integer from jsonb_array_elements(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')#>'{personal,histogram}') bin),6,'personal distribution includes all six runs');
select is((public.ml_dashboard('schulte-table','arcade-20261017','{"size":6,"direction":"asc","disappear":false,"durationMs":30000}')#>>'{population,histogram,0,low}')::numeric,900::numeric,'a different variant has its own distribution');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
select public.ml_submit('schulte-table',jsonb_build_object(
 'id','population-bob-1','endedAt',now(),'elapsedMs',25000,'durationMs',30000,'reason','error','score',10,
 'meta',jsonb_build_object('rulesVersion','arcade-20261017','rules','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}'::jsonb)),
 '00000000-0000-4000-8000-000000000012');
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')->'history'),1,'the second account sees only its own run');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')#>>'{population,aggregation}','recent-five-mean','public data identifies its aggregation method');
select is((select sum((bin->>'count')::integer)::integer from jsonb_array_elements(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')#>'{population,histogram}') bin),2,'seven runs from two accounts contribute only two points');
select is((public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')#>>'{population,histogram,0,low}')::numeric,6::numeric,'only the latest five runs contribute to the first account mean');
select is((public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')#>>'{population,histogram,9,high}')::numeric,10::numeric,'an account with fewer than five runs uses all available runs');
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')->'history'),0,'anonymous requests never expose personal history');
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}')#>'{personal,histogram}'),0,'anonymous requests never expose a personal distribution');

reset role;
select * from finish();
rollback;
