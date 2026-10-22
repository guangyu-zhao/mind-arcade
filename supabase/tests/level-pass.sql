begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

select is(mind_lab_private.level_pass('multiple-object-tracking',
 '{"targets":[0,2],"selected":[2,0]}','{}'),true,'tracking accepts the target set in either order');
select is(mind_lab_private.level_pass('multiple-object-tracking',
 '{"targets":[0,2],"selected":[1,2]}','{}'),false,'tracking rejects a different selection');
select is(mind_lab_private.level_pass('multiple-object-tracking',
 '{"targets":[],"selected":[]}','{}'),false,'tracking rejects an empty target set');
select is(mind_lab_private.level_pass('arithmetic-updating',
 '{"level":2,"channels":2,"tail":1,"initial":[2,3],"events":[{"channel":0,"value":1}],"responses":[[3],[3]]}',
 '{}'),true,'arithmetic updates are recomputed');
select is(mind_lab_private.level_pass('spatial-updating',
 '{"level":2,"channels":2,"tail":1,"initial":[0,8],"events":[{"channel":0,"value":0}],"responses":[[6],[8]]}',
 '{}'),true,'spatial updates wrap around the grid');
select is(mind_lab_private.level_pass('multi-stream-running-span',
 '{"level":2,"channels":2,"tail":1,"events":[{"channel":0,"value":1},{"channel":1,"value":2},{"channel":0,"value":3}],"responses":[[3],[2]]}',
 '{}'),true,'running span keeps the last item in each stream');
select is(mind_lab_private.level_pass('symmetry-span',
 '{"level":1,"positions":[0],"responses":[0],"judgments":[{"cells":[true,false,false,true,false,false,false,false,false,false,false,false,false,false,false,false],"response":true,"timedOut":false}]}',
 '{"order":"forward"}'),true,'symmetry span validates both judgment and recall');
select is(mind_lab_private.level_pass('symmetry-span-plus-plus',
 '{"level":1,"positions":[0],"responses":[3],"judgments":[{"frames":[{"target":0},{"target":3}],"response":"left-right","timedOut":false}]}',
 '{"size":4,"order":"reverse","transform":"rotated"}'),true,'symmetry span ++ validates a rotated response');
select is(mind_lab_private.level_pass('rotation-span',
 '{"level":2,"arrows":[0,1],"responses":[0,1],"judgments":[{"letter":"F","angle":45,"response":false,"mirrored":false,"timedOut":false},{"letter":"R","angle":90,"response":true,"mirrored":true,"timedOut":false}]}',
 '{}'),true,'rotation span validates judgment and arrow recall');

select * from finish();
rollback;
