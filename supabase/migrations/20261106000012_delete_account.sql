-- Deleting your account removes everything of yours and nothing anyone else relies on. A client's
-- workouts and maxes can point at their coach's custom exercises, which go with the coach, so each
-- person still using one gets their own copy first (or the one they already have by that name).

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  used record;
  v_copy uuid;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  for used in
    select owner_id, exercise_id from public.workout_blocks
    where owner_id <> me and exercise_id in (select id from public.exercises where owner_id = me)
    union
    select owner_id, exercise_id from public.training_maxes
    where owner_id <> me and exercise_id in (select id from public.exercises where owner_id = me)
  loop
    insert into public.exercises as x (owner_id, name, category, equipment, load_basis, archived_at)
    select used.owner_id, name, category, equipment, load_basis, archived_at
    from public.exercises where id = used.exercise_id
    on conflict (owner_id, lower(name)) do update set name = x.name
    returning id into v_copy;

    update public.workout_blocks set exercise_id = v_copy
    where owner_id = used.owner_id and exercise_id = used.exercise_id;
    update public.training_maxes set exercise_id = v_copy
    where owner_id = used.owner_id and exercise_id = used.exercise_id;
  end loop;

  -- Workouts go first: a block refuses to let its exercise be deleted (on delete restrict), and the
  -- cascade from auth.users reaches exercises before it reaches blocks.
  delete from public.workouts where owner_id = me;
  delete from auth.users where id = me;
end $$;

revoke execute on function public.delete_my_account from anon, public;
grant execute on function public.delete_my_account to authenticated;
