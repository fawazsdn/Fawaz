-- Rollback support functions of 20261109130000 (service role only). Synthetic accounts;
-- self-cleaning: the final RAISE aborts the transaction. Expected output: "ALL_PASS ...".
do $t$
declare u uuid := gen_random_uuid(); v uuid := gen_random_uuid(); n int; err text;
begin
  insert into auth.users(id,aud,role,email,instance_id) values (u,'authenticated','authenticated','rpc-'||u||'@example.invalid','00000000-0000-0000-0000-000000000000'),(v,'authenticated','authenticated','rpc-'||v||'@example.invalid','00000000-0000-0000-0000-000000000000');
  update public.profiles set avatar_path = u||'/a.jpg', avatar_url = null where id = u;
  update public.profiles set avatar_path = v||'/b.jpg', avatar_url = 'https://x/storage/v1/object/public/avatars/'||v||'/old.jpg' where id = v;
  select count(*) into n from public.avatar_restore_candidates() where id in (u,v);
  if n <> 1 then raise exception 'FAIL candidates %', n; end if;
  -- residents can't call either
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  begin perform public.avatar_restore_candidates(); err := null; exception when others then err := sqlstate; end;
  if err is distinct from '42501' then raise exception 'FAIL resident listed candidates: %', err; end if;
  begin perform public.set_restored_public_avatar(u, 'https://x/storage/v1/object/public/avatars/'||u||'/restored-a.jpg'); err := null; exception when others then err := sqlstate; end;
  if err is distinct from '42501' then raise exception 'FAIL resident set avatar: %', err; end if;
  perform set_config('role','anon',true);
  begin perform public.avatar_restore_candidates(); err := null; exception when others then err := sqlstate; end;
  if err is distinct from '42501' then raise exception 'FAIL anon listed candidates: %', err; end if;
  -- service role: only own folder, only candidates
  perform set_config('role','service_role',true);
  begin perform public.set_restored_public_avatar(u, 'https://x/storage/v1/object/public/avatars/'||v||'/restored-a.jpg'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:public_url' then raise exception 'FAIL other folder accepted: %', err; end if;
  begin perform public.set_restored_public_avatar(u, 'https://evil/x.jpg'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:public_url' then raise exception 'FAIL external url accepted: %', err; end if;
  begin perform public.set_restored_public_avatar(v, 'https://x/storage/v1/object/public/avatars/'||v||'/restored-b.jpg'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_a_candidate' then raise exception 'FAIL non-candidate overwritten: %', err; end if;
  perform public.set_restored_public_avatar(u, 'https://x/storage/v1/object/public/avatars/'||u||'/restored-a.jpg');
  begin perform count(*) from public.profiles; err := null; exception when others then err := sqlstate; end;
  perform set_config('role','postgres',true);
  if (select avatar_url from public.profiles where id = u) not like '%/avatars/'||u||'/restored-a.jpg' then raise exception 'FAIL not set'; end if;
  if (select avatar_url from public.profiles where id = v) not like '%/old.jpg' then raise exception 'FAIL v changed'; end if;
  raise exception 'ALL_PASS 8 checks (rolled back)';
end $t$;
