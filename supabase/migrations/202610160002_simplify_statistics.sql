begin;

create index if not exists ml_scores_distribution
  on public.ml_scores(condition_id, metric) include (value);

create or replace function public.ml_dashboard(p_game_id text,p_version text,p_rules jsonb,p_metric text default 'score') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cid text := mind_lab_private.condition_id(p_game_id,p_version,p_rules);
  uid uuid := auth.uid();
  population jsonb;
  personal jsonb;
  history jsonb;
begin
  select jsonb_build_object('histogram',mind_lab_private.histogram(array_agg(value)))
    into population from public.ml_scores where condition_id=cid and metric=p_metric;
  select jsonb_build_object('histogram',mind_lab_private.histogram(array_agg(value))),
    coalesce(jsonb_agg(jsonb_build_object('ended_at',ended_at,'value',value) order by ended_at,record_id),'[]'::jsonb)
    into personal,history from public.ml_scores
    where user_id=uid and condition_id=cid and metric=p_metric;
  return jsonb_build_object('population',population,'personal',personal,'history',history);
end;
$$;

notify pgrst, 'reload schema';
commit;
