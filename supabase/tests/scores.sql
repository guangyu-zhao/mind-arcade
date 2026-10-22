begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

select is((select count(*)::integer from public.ml_games),21,'all games are registered');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('ml_profiles','ml_games','ml_conditions','ml_records','ml_scores','ml_board_revisions') and c.relrowsecurity),6,'every public game table has RLS');
select ok(not has_function_privilege('anon','public.ml_submit(text,jsonb,uuid)','EXECUTE'),'anonymous callers cannot submit');
select ok(not has_table_privilege('authenticated','public.ml_scores','INSERT'),'clients cannot write scores directly');
select ok(not has_table_privilege('anon','public.ml_records','SELECT'),'raw history is private');
select ok(has_function_privilege('anon','public.ml_dashboard(text,text,jsonb,text)','EXECUTE'),'public aggregate is readable');

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001',encode(sha256(convert_to('test-alice','UTF8')),'hex')||'@users.mind-lab.invalid','{"username":"Test-Alice"}'),
 ('00000000-0000-4000-8000-000000000002',encode(sha256(convert_to('test-bob','UTF8')),'hex')||'@users.mind-lab.invalid','{"username":"Test-Bob"}');
select is((select username from public.ml_profiles where id='00000000-0000-4000-8000-000000000001'),'Test-Alice','auth registration creates a profile');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.ml_profiles),1,'a user reads only their profile');
select lives_ok($$select public.ml_submit('schulte-table',jsonb_build_object('id','test-run','endedAt',now(),'elapsedMs',25000,'durationMs',30000,'reason','error','score',10,'meta',jsonb_build_object('rulesVersion','arcade-20261017','rules','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}'::jsonb)),'00000000-0000-4000-8000-000000000001')$$,'a valid result is accepted');
select is((select count(*)::integer from public.ml_records),1,'submitted history is readable by its owner');
select is(public.ml_submit('schulte-table',jsonb_build_object('id','test-run','endedAt',now(),'elapsedMs',25000,'durationMs',30000,'reason','error','score',10,'meta',jsonb_build_object('rulesVersion','arcade-20261017','rules','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}'::jsonb)),'00000000-0000-4000-8000-000000000001')->>'duplicate','true','repeat submission is idempotent');
select throws_ok($$select public.ml_submit('schulte-table','{}','00000000-0000-4000-8000-000000000002')$$,'28000','authentication_required','one account cannot submit for another');
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}','score')->'history'),1,'dashboard includes the owner history');
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":6,"direction":"asc","disappear":false,"durationMs":30000}','score')->'history'),0,'other variants are excluded');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.ml_records),0,'another account cannot read the first account history');
select is(jsonb_array_length(public.ml_dashboard('schulte-table','arcade-20261017','{"size":5,"direction":"asc","disappear":false,"durationMs":30000}','score')->'history'),0,'dashboard never returns another account personal history');
select lives_ok($$select public.ml_submit('multiple-object-tracking',jsonb_build_object('id','tracking-run','endedAt',now(),'elapsedMs',5000,'status','stopped','reason','user','score',1,'lives',3,'trials','[{"level":1,"targets":[0],"selected":[0],"initial":[{"x":100,"y":100,"vx":60,"vy":0},{"x":240,"y":100,"vx":60,"vy":0},{"x":380,"y":100,"vx":60,"vy":0},{"x":520,"y":100,"vx":60,"vy":0},{"x":100,"y":240,"vx":60,"vy":0},{"x":240,"y":240,"vx":60,"vy":0}],"final":[{"x":100,"y":100},{"x":240,"y":100},{"x":380,"y":100},{"x":520,"y":100},{"x":100,"y":240},{"x":240,"y":240}],"motionMs":4000}]'::jsonb,'meta',jsonb_build_object('rulesVersion','arcade-20261017','rules','{}'::jsonb)),'00000000-0000-4000-8000-000000000002')$$,'tracking results pass server validation and can be saved');
reset role;
select * from finish();
rollback;
