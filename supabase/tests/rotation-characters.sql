begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(18);

select is(mind_lab_private.level_pass('rotation-span', jsonb_build_object(
  'level', 1, 'arrows', '[0]'::jsonb, 'responses', '[0]'::jsonb,
  'judgments', jsonb_build_array(jsonb_build_object(
    'letter', character, 'angle', 45, 'response', false, 'mirrored', false, 'timedOut', false
  ))), '{}'), true, 'accepts current character ' || character)
from unnest(array['2','4','5','7','Q','R','P','S','F','G','J','L','@','&','%','?']) as character;

select throws_ok($$select mind_lab_private.level_pass('rotation-span',
  '{"level":1,"arrows":[0],"responses":[0],"judgments":[{"letter":"X","angle":45}]}',
  '{}')$$, 'P0001', 'invalid_character', 'rejects a character outside the recorded pool');
select throws_ok($$select mind_lab_private.level_pass('rotation-span',
  '{"level":1,"arrows":[0],"responses":[0],"judgments":[{"letter":"?","angle":0}]}',
  '{}')$$, 'P0001', 'invalid_character', 'rejects an unrotated character');

select * from finish();
rollback;
