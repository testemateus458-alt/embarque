-- Execute uma vez no SQL Editor de um projeto Supabase novo.
create type public.app_role as enum ('visualizador','operador','admin');
create type public.shipment_status as enum ('Pendente','Em processo','Falta item','Concluído');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '',
 role public.app_role not null default 'visualizador',
 active boolean not null default true
);
create table public.docks (
 id smallint primary key check (id between 1 and 99),
 name text not null unique
);
insert into public.docks values (1,'Doca 01'),(2,'Doca 02'),(3,'Doca 03'),(4,'Doca 04'),(5,'Doca 05'),(6,'Doca 06');
create table public.shipments (
 id uuid primary key default gen_random_uuid(),
 number text not null unique check(length(trim(number)) between 1 and 50),
 nf text not null default '',
 destination text not null check(length(trim(destination)) between 1 and 200),
 carrier text not null default '',
 driver text not null default '',
 plate text not null default '',
 vehicle text not null default 'Carreta',
 dock_id smallint references public.docks(id),
 scheduled_at timestamptz not null,
 volumes integer not null default 0 check(volumes >= 0),
 weight numeric(12,2) not null default 0 check(weight >= 0),
 responsible text not null default '',
 notes text not null default '',
 missing_item_notes text not null default '',
 status public.shipment_status not null default 'Pendente',
 shipped_at timestamptz,
 started_at timestamptz,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 check (status <> 'Falta item' or length(trim(missing_item_notes)) > 0)
);
-- A doca fica ocupada durante carregamento e conferência, independente do dia.
create index shipment_schedule on public.shipments(scheduled_at);
create table public.audit_log (
 id bigint generated always as identity primary key,
 shipment_id uuid,
 shipment_number text,
 action text not null,
 actor_id uuid,
 actor_name text,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);
create function public.current_app_role() returns public.app_role
 language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id=auth.uid() and active=true
$$;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create function public.new_user_profile() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user_profile();

create function public.shipment_before_update() returns trigger
 language plpgsql set search_path = '' as $$
begin
 new.version := old.version + 1;
 new.created_at := old.created_at;
 new.updated_at := now();
 new.started_at := old.started_at;
 if new.status='Em processo' and (old.started_at is null or old.status='Concluído') then new.started_at:=now(); end if;
 if new.status='Pendente' then new.started_at:=null; end if;
 if new.status = 'Concluído' then
  -- Respeita a data informada pelo operador e usa agora apenas como padrão.
  new.shipped_at := coalesce(new.shipped_at, old.shipped_at, now());
 else
  new.shipped_at := null;
 end if;
 return new;
end $$;
create trigger shipment_version before update on public.shipments for each row execute function public.shipment_before_update();
create function public.shipment_before_insert() returns trigger language plpgsql set search_path='' as $$
begin
 new.version:=1; new.created_at:=now(); new.updated_at:=now();
 new.started_at:=case when new.status='Em processo' then now() else null end;
 new.shipped_at:=case when new.status='Concluído' then coalesce(new.shipped_at,now()) else null end;
 return new;
end $$;
create trigger shipment_insert before insert on public.shipments for each row execute function public.shipment_before_insert();

create function public.audit_shipment() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_log(shipment_id,shipment_number,action,actor_id,actor_name,before_data,after_data)
 values(coalesce(new.id,old.id),coalesce(new.number,old.number),tg_op,auth.uid(),
 (select name from public.profiles where id=auth.uid()),
 case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create trigger shipment_audit after insert or update or delete on public.shipments for each row execute function public.audit_shipment();

alter table public.profiles enable row level security;
alter table public.docks enable row level security;
alter table public.shipments enable row level security;
alter table public.audit_log enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.current_app_role()='admin');
create policy profiles_admin on public.profiles for update to authenticated using(public.current_app_role()='admin') with check(public.current_app_role()='admin');
create policy docks_read on public.docks for select to authenticated using(public.current_app_role() is not null);
create policy shipments_read on public.shipments for select to authenticated using(public.current_app_role() is not null);
create policy shipments_insert on public.shipments for insert to authenticated with check(public.current_app_role() in ('operador','admin'));
create policy shipments_update on public.shipments for update to authenticated using(public.current_app_role() in ('operador','admin')) with check(public.current_app_role() in ('operador','admin'));
create policy shipments_delete on public.shipments for delete to authenticated using(public.current_app_role()='admin');
create policy audit_read on public.audit_log for select to authenticated using(public.current_app_role() is not null);
revoke all on public.profiles, public.docks, public.shipments, public.audit_log from anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.docks,public.audit_log to authenticated;
grant select,insert,update,delete on public.shipments to authenticated;
-- Clientes não podem gravar nem apagar a auditoria.
alter publication supabase_realtime add table public.shipments,public.docks,public.profiles,public.audit_log;
