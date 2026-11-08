\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';

do $test$
declare
  resident uuid := gen_random_uuid();
  other_resident uuid := gen_random_uuid();
  administrator uuid := gen_random_uuid();
  ajyal constant text := 'sa-district-10500227013';
  listing uuid;
  claim uuid;
  correction uuid;
  suggestion uuid;
begin
  if has_function_privilege('anon','public.submit_business_directory_request(text,uuid,text,text)','execute')
    or has_function_privilege('anon','public.review_business_directory_request(uuid,boolean)','execute')
    or has_table_privilege('authenticated','public.business_directory_requests','UPDATE') then
    raise exception 'directory grants too broad';
  end if;

  insert into auth.users(id,aud,role,email,instance_id)
    select x,'authenticated','authenticated',x || '@example.invalid','00000000-0000-0000-0000-000000000000'
    from unnest(array[resident,other_resident,administrator]) x;
  update public.profiles set app_role = 'admin' where id = administrator;

  insert into public.businesses (name,category,verified) values ('Temporary directory fixture','restaurant',true) returning id into listing;
  insert into public.business_neighborhoods (business_id,neighborhood_id) values (listing,ajyal);

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',administrator,'role','authenticated')::text,true);
  perform public.admin_verify_member(resident,ajyal,'Rollback-only directory test');
  perform public.admin_verify_member(other_resident,ajyal,'Rollback-only directory test');

  perform set_config('request.jwt.claims',json_build_object('sub',resident,'role','authenticated')::text,true);
  if not exists (select from public.businesses b join public.business_neighborhoods bn on bn.business_id=b.id
     where b.id=listing and bn.neighborhood_id=ajyal) then
    raise exception 'resident could not read a published Ajyal listing';
  end if;
  suggestion := public.submit_business_directory_request(ajyal,null,'suggestion','Rollback-only suggestion.');
  correction := public.submit_business_directory_request(ajyal,listing,'correction','Rollback-only correction.');
  claim := public.submit_business_directory_request(ajyal,listing,'claim','Rollback-only ownership claim.');

  begin
    perform public.submit_business_directory_request(ajyal,listing,'claim','Rollback-only duplicate claim.');
    raise exception 'duplicate pending claim was accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.review_business_directory_request(claim,true);
    raise exception 'resident approved ownership';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_business_directory_request('unknown-neighborhood',null,'suggestion','Rollback-only out-of-area suggestion.');
    raise exception 'out-of-area submission accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.businesses(owner_id,name,category,verified) values(resident,'Temporary self-verification fixture','restaurant',true);
    raise exception 'resident self-verified a business';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims',json_build_object('sub',other_resident,'role','authenticated')::text,true);
  if exists (select from public.business_directory_requests where id in (suggestion,correction,claim)) then
    raise exception 'private requests visible to another resident';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',administrator,'role','authenticated')::text,true);
  perform public.review_business_directory_request(suggestion,true);
  perform public.review_business_directory_request(correction,false);
  perform public.review_business_directory_request(claim,true);
  if (select owner_id from public.businesses where id=listing) is distinct from resident then
    raise exception 'staff approval did not assign owner';
  end if;
  if (select count(*) from public.business_directory_requests where id in (suggestion,correction,claim) and reviewed_by=administrator) <> 3 then
    raise exception 'staff review record incomplete';
  end if;
end $test$;

rollback;
