-- For the existing project only: verify the installed schema before recording its manual migrations.
begin;
do $$
declare item record; actual text;
begin
  for item in select * from (values
      ('mind_lab_private.new_user','33adb11e5e3bbde7acce4d5254e7d1d4'),
      ('mind_lab_private.condition_id','478fcc612cf0aa9dde56dc74184baeaa'),
      ('mind_lab_private.valid_integer','c6d09b35cdf7bff53eb25f4dcb651f66'),
      ('mind_lab_private.level_pass','68521b63d586fbd7e1ff0c0c6a845fb9'),
      ('mind_lab_private.mn_back_score','151214a7270cb082e5b7deb4d453ec55'),
      ('public.ml_submit','269d022c53401ebe391418e60b21ce71'),
      ('mind_lab_private.histogram','70700c062b65d5ab522aab95e9d9b823')
    ) as expected(name,hash)
  loop
    select md5(regexp_replace(p.prosrc,'\s','','g')) into actual from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=item.name;
    if actual is distinct from item.hash then raise exception 'Schema differs from the manual baseline: %',item.name; end if;
  end loop;
  select md5(regexp_replace(prosrc,'\s','','g')) into actual
    from pg_proc where oid='public.ml_dashboard(text,text,jsonb,text)'::regprocedure;
  if actual is null or actual not in ('a80b300690ce6c94ac5287170635c52f','152326221db506a73b228ffd6c7f8930') then
    raise exception 'Statistics function differs from the manual migrations';
  end if;
  if to_regclass('public.ml_scores_distribution') is null then raise exception 'Statistics migration is missing'; end if;
  if (select count(*) from public.ml_games) <> 22 then raise exception 'Game registry differs'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ml_profiles','ml_games','ml_conditions','ml_records','ml_scores','ml_board_revisions') and c.relrowsecurity) <> 6 then raise exception 'RLS baseline differs'; end if;
end;
$$;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations(version,name,statements) values
 ('202610160001','cloud_scores',array[]::text[]),
 ('202610160002','simplify_statistics',array[]::text[]),
 ('202610170001','fix_tracking_score_validation',array[]::text[]),
 ('202610170002','current_rules',array[]::text[]),
 ('202610220001','rotation_characters',array[]::text[]),
 ('202610230001','validate_judgment_counts',array[]::text[]),
 ('202610230002','validate_updating_tracking',array[]::text[]),
 ('202610250001','validate_symmetry_plus_settings',array[]::text[]),
 ('202610250002','mn_back',array[]::text[]),
 ('202610270001','mn_back_timing',array[]::text[])
on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations(version,name,statements)
  select '202610170003','population_recent_five',array[]::text[] from pg_proc
  where oid='public.ml_dashboard(text,text,jsonb,text)'::regprocedure
    and md5(regexp_replace(prosrc,'\s','','g'))='152326221db506a73b228ffd6c7f8930'
on conflict (version) do nothing;
commit;
select version,name from supabase_migrations.schema_migrations order by version;
