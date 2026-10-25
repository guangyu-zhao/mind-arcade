begin;

drop index if exists public.ml_scores_distribution;
create index ml_scores_distribution
  on public.ml_scores(condition_id, metric, user_id, ended_at desc, record_id desc)
  include (value);

create or replace function public.ml_dashboard(p_game_id text,p_version text,p_rules jsonb,p_metric text default 'score') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid text; uid uuid:=auth.uid(); population jsonb; personal jsonb; history jsonb;
begin
  if p_metric<>'score' or not exists(select 1 from public.ml_games where id=p_game_id and version=p_version) then raise exception 'unsupported_rules'; end if;
  cid:=mind_lab_private.condition_id(p_game_id,p_version,p_rules);
  with ranked as (
    select user_id,value,row_number() over (
      partition by user_id order by ended_at desc,record_id desc
    ) as position
    from public.ml_scores where condition_id=cid and metric='score'
  ), player_means as (
    select avg(value) as value from ranked where position<=5 group by user_id
  )
  select jsonb_build_object(
    'aggregation','recent-five-mean',
    'histogram',mind_lab_private.histogram(array_agg(value))
  ) into population from player_means;
  select jsonb_build_object('histogram',mind_lab_private.histogram(array_agg(value))),
    coalesce(jsonb_agg(jsonb_build_object('ended_at',ended_at,'value',value) order by ended_at,record_id),'[]'::jsonb)
    into personal,history from public.ml_scores where user_id=uid and condition_id=cid and metric='score';
  return jsonb_build_object('population',population,'personal',personal,'history',history);
end;
$$;

update public.ml_board_revisions set revision=revision+1;
notify pgrst, 'reload schema';
commit;
