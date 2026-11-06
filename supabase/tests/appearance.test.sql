-- Appearance settings: named themes and accents by id, and the glass switch.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'authenticated', 'authenticated', 'a@test.local');

select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-0000000000a0', 'role', 'authenticated')::text, true);
set local role authenticated;

select results_eq($$ select theme, accent, glass from public.profiles $$, $$ values ('midnight', 'theme', true) $$,
  'new profiles start on Midnight with its own accent and glass on');
select lives_ok($$ update public.profiles set theme = 'chalk', accent = 'rose', glass = false $$, 'the owner picks a theme, accent and solid surfaces');
select lives_ok($$ update public.profiles set theme = 'system' $$, 'System is still a choice');
select throws_ok($$ update public.profiles set theme = 'Neon Pink!' $$, '23514', null, 'theme ids are lowercase words');
select throws_ok($$ update public.profiles set accent = '' $$, '23514', null, 'accent ids cannot be empty');
select is((select theme from public.profiles), 'system', 'the last valid choice is kept');

select * from finish();
rollback;
