-- Etapa 1 (não quebra o site antigo): leitura pública + Realtime + funções de
-- edição protegidas pela senha única. Pode ser aplicada antes do novo deploy.

create extension if not exists pgcrypto with schema extensions;

-- Esquema privado: não é exposto pela API (PostgREST só expõe "public").
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.edit_secret (
  id smallint primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.edit_secret from public, anon, authenticated;
-- Senha de edição: 162424 (guardada só como hash bcrypt).
insert into private.edit_secret (id, password_hash)
values (1, extensions.crypt('162424', extensions.gen_salt('bf', 10)))
on conflict (id) do nothing;

-- Autorizações curtas para enviar/apagar arquivos no bucket carga-fotos.
create table if not exists private.photo_tickets (
  path text not null,
  kind text not null check (kind in ('upload','delete')),
  expires_at timestamptz not null,
  primary key (path, kind)
);
revoke all on private.photo_tickets from public, anon, authenticated;

create or replace function private.require_edit_password(p_password text)
returns void language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  select coalesce(p_password, '') <> ''
     and password_hash = extensions.crypt(p_password, password_hash)
    into ok from private.edit_secret where id = 1;
  if not coalesce(ok, false) then
    perform pg_sleep(1.5); -- freia tentativas de adivinhar a senha
    raise exception 'Senha de edição inválida.' using errcode = '28P01';
  end if;
  perform set_config('app.actor_name', 'Edição com senha', true);
end $$;
revoke all on function private.require_edit_password(text) from public, anon, authenticated;

-- Auditoria: sem login, registra o autor como "Edição com senha".
create or replace function public.audit_shipment() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_log(shipment_id,shipment_number,action,actor_id,actor_name,before_data,after_data)
 values(coalesce(new.id,old.id),coalesce(new.number,old.number),tg_op,auth.uid(),
 coalesce((select name from public.profiles where id=auth.uid()), nullif(current_setting('app.actor_name', true), '')),
 case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;

create or replace function private.insert_shipment(p_data jsonb)
returns public.shipments language plpgsql security definer set search_path = '' as $$
declare r public.shipments;
begin
  r := jsonb_populate_record(null::public.shipments, p_data);
  insert into public.shipments(number,nf,destination,carrier,driver,plate,vehicle,dock_id,scheduled_at,
    volumes,weight,responsible,notes,missing_item_notes,status,shipped_at)
  values(r.number, coalesce(r.nf,''), r.destination, coalesce(r.carrier,''), coalesce(r.driver,''),
    coalesce(r.plate,''), coalesce(r.vehicle,'Carreta'), r.dock_id, r.scheduled_at,
    coalesce(r.volumes,0), coalesce(r.weight,0), coalesce(r.responsible,''), coalesce(r.notes,''),
    coalesce(r.missing_item_notes,''), coalesce(r.status,'Pendente'), r.shipped_at)
  returning * into r;
  return r;
end $$;
revoke all on function private.insert_shipment(jsonb) from public, anon, authenticated;

-- Atualiza só se a versão bater (controle de concorrência). Devolve NULL se outra pessoa alterou antes.
create or replace function private.update_shipment(p_data jsonb)
returns public.shipments language plpgsql security definer set search_path = '' as $$
declare cur public.shipments; r public.shipments;
begin
  if nullif(p_data->>'version','') is null then
    raise exception 'Versão do lote não informada.' using errcode = '22023';
  end if;
  select * into cur from public.shipments
   where id = (p_data->>'id')::uuid and version = (p_data->>'version')::int for update;
  if not found then return null; end if;
  r := jsonb_populate_record(cur, p_data - 'id' - 'version' - 'created_at' - 'updated_at' - 'started_at');
  update public.shipments set number=r.number, nf=r.nf, destination=r.destination, carrier=r.carrier,
    driver=r.driver, plate=r.plate, vehicle=r.vehicle, dock_id=r.dock_id, scheduled_at=r.scheduled_at,
    volumes=r.volumes, weight=r.weight, responsible=r.responsible, notes=r.notes,
    missing_item_notes=r.missing_item_notes, status=r.status, shipped_at=r.shipped_at
  where id = cur.id returning * into r;
  return r;
end $$;
revoke all on function private.update_shipment(jsonb) from public, anon, authenticated;

-- ===== Funções chamadas pelo site (RPC). Todas exigem a senha. =====
create or replace function public.edit_check_password(p_password text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_edit_password(p_password);
  return true;
end $$;

create or replace function public.edit_save_shipment(p_password text, p_data jsonb)
returns public.shipments language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_edit_password(p_password);
  if nullif(p_data->>'id','') is null then
    return private.insert_shipment(p_data - 'id' - 'version');
  end if;
  return private.update_shipment(p_data);
end $$;

-- Importação do romaneio: insere todos os novos e corrige os existentes de uma vez (tudo ou nada).
create or replace function public.edit_import_shipments(p_password text, p_new jsonb, p_updates jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; created int := 0; corrected int := 0; r public.shipments;
begin
  perform private.require_edit_password(p_password);
  for item in select * from jsonb_array_elements(coalesce(p_new,'[]'::jsonb)) loop
    perform private.insert_shipment(item - 'id' - 'version'); created := created + 1;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_updates,'[]'::jsonb)) loop
    r := private.update_shipment(item);
    if r.id is null then
      raise exception 'O lote % foi alterado durante a importação. Confira a prévia e tente novamente.', coalesce(item->>'number', item->>'id') using errcode = '40001';
    end if;
    corrected := corrected + 1;
  end loop;
  return jsonb_build_object('created', created, 'corrected', corrected);
end $$;

create or replace function public.edit_delete_shipment(p_password text, p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_edit_password(p_password);
  delete from public.shipments where id = p_id;
  return found;
end $$;

-- Libera o envio de UMA foto para o caminho devolvido (válido por 10 minutos).
create or replace function public.edit_photo_upload_ticket(p_password text, p_shipment_id uuid, p_extension text)
returns text language plpgsql security definer set search_path = '' as $$
declare ext text; v_path text;
begin
  perform private.require_edit_password(p_password);
  if not exists (select 1 from public.shipments where id = p_shipment_id) then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  ext := lower(coalesce(nullif(regexp_replace(p_extension, '[^a-zA-Z0-9]', '', 'g'), ''), 'jpg'));
  if ext not in ('jpg','jpeg','png','webp') then ext := 'jpg'; end if;
  v_path := p_shipment_id::text || '/' || (extract(epoch from clock_timestamp()) * 1000)::bigint
            || '-' || substr(md5(random()::text), 1, 6) || '.' || ext;
  delete from private.photo_tickets where expires_at < now();
  insert into private.photo_tickets(path, kind, expires_at) values (v_path, 'upload', now() + interval '10 minutes');
  return v_path;
end $$;

create or replace function public.edit_add_photo(p_password text, p_shipment_id uuid, p_url text)
returns public.shipment_photos language plpgsql security definer set search_path = '' as $$
declare r public.shipment_photos;
begin
  perform private.require_edit_password(p_password);
  if position('/storage/v1/object/public/carga-fotos/' || p_shipment_id::text || '/' in coalesce(p_url,'')) = 0 then
    raise exception 'Endereço da foto inválido.' using errcode = '22023';
  end if;
  insert into public.shipment_photos(shipment_id, url) values (p_shipment_id, p_url) returning * into r;
  return r;
end $$;

-- Remove o registro da foto e libera a exclusão do arquivo no Storage. Devolve o caminho do arquivo.
create or replace function public.edit_delete_photo(p_password text, p_photo_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_url text; v_path text; i int;
begin
  perform private.require_edit_password(p_password);
  delete from public.shipment_photos where id = p_photo_id returning url into v_url;
  if v_url is null then return null; end if;
  i := position('/storage/v1/object/public/carga-fotos/' in v_url);
  if i > 0 then
    v_path := substr(v_url, i + length('/storage/v1/object/public/carga-fotos/'));
    delete from private.photo_tickets where expires_at < now();
    insert into private.photo_tickets(path, kind, expires_at) values (v_path, 'delete', now() + interval '10 minutes')
      on conflict (path, kind) do update set expires_at = excluded.expires_at;
  end if;
  return v_path;
end $$;

-- Usada pelas políticas do Storage (etapa 2).
create or replace function public.carga_foto_ticket(p_name text, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.photo_tickets where path = p_name and kind = p_kind and expires_at > now())
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.edit_check_password(text)','public.edit_save_shipment(text,jsonb)',
    'public.edit_import_shipments(text,jsonb,jsonb)','public.edit_delete_shipment(text,uuid)',
    'public.edit_photo_upload_ticket(text,uuid,text)','public.edit_add_photo(text,uuid,text)',
    'public.edit_delete_photo(text,uuid)','public.carga_foto_ticket(text,text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- Tempo real para todos os visitantes.
do $$
declare t text;
begin
  foreach t in array array['shipments','shipment_photos','audit_log','docks'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
