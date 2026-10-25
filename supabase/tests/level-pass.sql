begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

select is(mind_lab_private.level_pass('multiple-object-tracking',
 '{"level":3,"targets":[0,2],"selected":[2,0],"initial":[{"x":100,"y":100,"vx":80,"vy":0},{"x":240,"y":100,"vx":80,"vy":0},{"x":380,"y":100,"vx":80,"vy":0},{"x":520,"y":100,"vx":80,"vy":0},{"x":100,"y":240,"vx":80,"vy":0},{"x":240,"y":240,"vx":80,"vy":0},{"x":380,"y":240,"vx":80,"vy":0},{"x":520,"y":240,"vx":80,"vy":0}],"final":[{"x":100,"y":100},{"x":240,"y":100},{"x":380,"y":100},{"x":520,"y":100},{"x":100,"y":240},{"x":240,"y":240},{"x":380,"y":240},{"x":520,"y":240}],"motionMs":4000}','{}'),true,'tracking accepts the target set in either order');
select is(mind_lab_private.level_pass('multiple-object-tracking',
 '{"level":3,"targets":[0,2],"selected":[1,2],"initial":[{"x":100,"y":100,"vx":80,"vy":0},{"x":240,"y":100,"vx":80,"vy":0},{"x":380,"y":100,"vx":80,"vy":0},{"x":520,"y":100,"vx":80,"vy":0},{"x":100,"y":240,"vx":80,"vy":0},{"x":240,"y":240,"vx":80,"vy":0},{"x":380,"y":240,"vx":80,"vy":0},{"x":520,"y":240,"vx":80,"vy":0}],"final":[{"x":100,"y":100},{"x":240,"y":100},{"x":380,"y":100},{"x":520,"y":100},{"x":100,"y":240},{"x":240,"y":240},{"x":380,"y":240},{"x":520,"y":240}],"motionMs":4000}','{}'),false,'tracking rejects a different selection');
select throws_ok($$select mind_lab_private.level_pass('multiple-object-tracking','{"level":1,"targets":[],"selected":[],"initial":[{"x":100,"y":100,"vx":60,"vy":0},{"x":240,"y":100,"vx":60,"vy":0},{"x":380,"y":100,"vx":60,"vy":0},{"x":520,"y":100,"vx":60,"vy":0},{"x":100,"y":240,"vx":60,"vy":0},{"x":240,"y":240,"vx":60,"vy":0}],"final":[{"x":100,"y":100},{"x":240,"y":100},{"x":380,"y":100},{"x":520,"y":100},{"x":100,"y":240},{"x":240,"y":240}],"motionMs":4000}','{}')$$,'P0001','invalid_level_parameters','tracking rejects an empty target set');
select is(mind_lab_private.level_pass('arithmetic-updating',
 '{"level":2,"channels":2,"tail":1,"initial":[2,3],"events":[{"channel":0,"value":1},{"channel":1,"value":1},{"channel":1,"value":1},{"channel":0,"value":1},{"channel":0,"value":1},{"channel":1,"value":1}],"responses":[[5],[6]]}',
 '{}'),true,'arithmetic updates are recomputed');
select is(mind_lab_private.level_pass('spatial-updating',
 '{"level":2,"channels":2,"tail":1,"initial":[0,8],"events":[{"channel":0,"value":0},{"channel":1,"value":0},{"channel":1,"value":0},{"channel":0,"value":0},{"channel":0,"value":0},{"channel":1,"value":0}],"responses":[[0],[8]]}',
 '{}'),true,'spatial updates wrap around the grid');
select is(mind_lab_private.level_pass('multi-stream-running-span',
 '{"level":2,"channels":2,"tail":1,"initial":[],"events":[{"channel":0,"value":1},{"channel":1,"value":2},{"channel":0,"value":3},{"channel":1,"value":4}],"responses":[[3],[4]]}',
 '{"tail":1}'),true,'running span keeps the last item in each stream');
select is(mind_lab_private.level_pass('symmetry-span',
 '{"level":1,"positions":[0],"responses":[0],"judgments":[{"cells":[true,false,false,true,false,false,false,false,false,false,false,false,false,false,false,false],"response":true,"timedOut":false}]}',
 '{"order":"forward"}'),true,'symmetry span validates both judgment and recall');
select is(mind_lab_private.level_pass('symmetry-span-plus-plus',
 '{"level":1,"positions":[0],"responses":[3],"targetColor":"blue","distractorColor":"orange","memoryDistractors":[null],"rules":{"size":4,"flashCount":2,"symmetryInterference":false,"sequenceInterference":false,"order":"reverse","transform":"rotated"},"judgments":[{"frames":[{"target":0,"distractor":null},{"target":3,"distractor":null}],"response":"left-right","timedOut":false}]}',
 '{"size":4,"flashCount":2,"symmetryInterference":false,"sequenceInterference":false,"order":"reverse","transform":"rotated"}'),true,'symmetry span ++ validates a rotated response');
select is(mind_lab_private.level_pass('rotation-span',
 '{"level":2,"arrows":[0,1],"responses":[0,1],"judgments":[{"letter":"F","angle":45,"response":false,"mirrored":false,"timedOut":false},{"letter":"R","angle":90,"response":true,"mirrored":true,"timedOut":false}]}',
 '{}'),true,'rotation span validates judgment and arrow recall');

select * from finish();
rollback;
