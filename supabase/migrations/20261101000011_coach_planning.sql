-- Coach planning: a coach edits and reschedules the workouts they assigned until the client starts one.
-- Starting it (the first set logged) hands it back to the client, read-only to the coach as before.
-- A coach changes the plan only, never the log: guard triggers allow a non-owner the plan columns alone.

-- Owners are re-derived on every write, not just when a row moves, so a coach editing a client's block
-- or set can't hand the row to someone else.
drop trigger workout_blocks_owner on public.workout_blocks;
create trigger workout_blocks_owner before insert or update on public.workout_blocks
  for each row execute function public.inherit_block_owner();
drop trigger workout_sets_owner on public.workout_sets;
create trigger workout_sets_owner before insert or update on public.workout_sets
  for each row execute function public.inherit_set_owner();

-- An unstarted workout you assigned to someone you still coach. Security definer so policies on blocks
-- and sets can ask without recursing through RLS.
create function public.coach_can_edit(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout and w.kind = 'workout' and w.status = 'planned'
      and w.assigned_by = auth.uid() and w.owner_id in (select public.my_client_ids())
  )
$$;

create function public.coach_can_edit_block(p_block uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.coach_can_edit((select workout_id from public.workout_blocks where id = p_block))
$$;

create policy "workouts: coach edits unstarted assignment" on public.workouts
  for update to authenticated
  using (assigned_by = (select auth.uid()) and status = 'planned' and kind = 'workout' and owner_id in (select public.my_client_ids()))
  with check (assigned_by = (select auth.uid()) and status = 'planned' and kind = 'workout' and owner_id in (select public.my_client_ids()));

create policy "workout_blocks: coach adds to unstarted assignment" on public.workout_blocks
  for insert to authenticated with check (public.coach_can_edit(workout_id));
create policy "workout_blocks: coach edits unstarted assignment" on public.workout_blocks
  for update to authenticated using (public.coach_can_edit(workout_id)) with check (public.coach_can_edit(workout_id));
create policy "workout_blocks: coach removes from unstarted assignment" on public.workout_blocks
  for delete to authenticated using (public.coach_can_edit(workout_id));

create policy "workout_sets: coach adds to unstarted assignment" on public.workout_sets
  for insert to authenticated with check (public.coach_can_edit_block(block_id));
create policy "workout_sets: coach edits unstarted assignment" on public.workout_sets
  for update to authenticated using (public.coach_can_edit_block(block_id)) with check (public.coach_can_edit_block(block_id));
create policy "workout_sets: coach removes from unstarted assignment" on public.workout_sets
  for delete to authenticated using (public.coach_can_edit_block(block_id));

-- The guards act on writes from the app only. Inside a security definer function current_user is the
-- function's owner, so assign_template, start_program and the rest still stamp what they need.

-- On someone else's workout, only the title, subtitle and date change.
create function public.protect_client_workout() returns trigger
language plpgsql set search_path = '' as $$
declare
  keep text[] := array['title', 'subtitle', 'scheduled_for', 'updated_at'];
begin
  if current_user = 'authenticated' and old.owner_id is distinct from auth.uid()
     and (to_jsonb(new) - keep) is distinct from (to_jsonb(old) - keep) then
    raise exception 'coach_edits_plan_only' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger workouts_protect before update on public.workouts
  for each row execute function public.protect_client_workout();

-- On someone else's sets, nothing logged or frozen is written. A planned set can already hold typed
-- actuals (Train mode saves them before the tick), so this compares rather than requiring nulls.
-- Named to fire after workout_sets_owner (triggers fire in name order), so owner_id is the real owner.
create function public.protect_client_sets() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.owner_id is distinct from auth.uid() then
    if (tg_op = 'INSERT' and num_nonnulls(new.actual_reps, new.actual_weight_kg, new.completed_at, new.basis_max_kg, new.prescribed_load_kg) > 0)
       or (tg_op = 'UPDATE' and (new.actual_reps, new.actual_weight_kg, new.completed_at, new.basis_max_kg, new.prescribed_load_kg)
           is distinct from (old.actual_reps, old.actual_weight_kg, old.completed_at, old.basis_max_kg, old.prescribed_load_kg)) then
      raise exception 'coach_edits_plan_only' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger workout_sets_protect before insert or update on public.workout_sets
  for each row execute function public.protect_client_sets();

-- An empty workout on a client's calendar, to fill in from the editor.
create function public.assign_blank_workout(
  p_client uuid,
  p_scheduled_for date default null,
  p_new_id uuid default gen_random_uuid()
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coach_of(p_client) then
    raise exception 'not_your_client';
  end if;
  insert into public.workouts (id, owner_id, kind, scheduled_for, assigned_by, assigned_at)
  values (p_new_id, p_client, 'workout', p_scheduled_for, auth.uid(), now());
  return p_new_id;
end $$;

revoke execute on function public.coach_can_edit, public.coach_can_edit_block, public.assign_blank_workout from anon, public;
grant execute on function public.coach_can_edit, public.coach_can_edit_block, public.assign_blank_workout to authenticated;
