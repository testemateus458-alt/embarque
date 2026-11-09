-- Etapa 2: aplicar LOGO APÓS publicar o novo site (o site antigo grava direto nas tabelas).
-- Leitura continua pública; qualquer escrita só pelas funções edit_* (com a senha).

alter table public.shipments enable row level security;
alter table public.docks enable row level security;
alter table public.audit_log enable row level security;
alter table public.shipment_photos enable row level security;
alter table public.profiles enable row level security;

-- Remove políticas antigas (login por perfil e escrita aberta das fotos).
drop policy if exists shipments_read on public.shipments;
drop policy if exists shipments_insert on public.shipments;
drop policy if exists shipments_update on public.shipments;
drop policy if exists shipments_delete on public.shipments;
drop policy if exists docks_read on public.docks;
drop policy if exists audit_read on public.audit_log;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_admin on public.profiles;
drop policy if exists "shipment photos envio" on public.shipment_photos;
drop policy if exists "shipment photos leitura" on public.shipment_photos;
drop policy if exists anon_delete_shipment_photos on public.shipment_photos;

create policy leitura_publica on public.shipments for select to anon, authenticated using (true);
create policy leitura_publica on public.docks for select to anon, authenticated using (true);
create policy leitura_publica on public.audit_log for select to anon, authenticated using (true);
create policy leitura_publica on public.shipment_photos for select to anon, authenticated using (true);
-- profiles: sem política => ninguém lê pela API (não é mais usado pelo site).

revoke all on public.shipments, public.docks, public.audit_log, public.shipment_photos, public.profiles from anon, authenticated;
grant select on public.shipments, public.docks, public.audit_log, public.shipment_photos to anon, authenticated;

-- Storage carga-fotos: leitura pública; envio/exclusão só com autorização emitida pelas funções com senha.
drop policy if exists "carga fotos envio" on storage.objects;
drop policy if exists anon_delete_carga_fotos on storage.objects;
drop policy if exists carga_fotos_envio_com_senha on storage.objects;
drop policy if exists carga_fotos_exclusao_com_senha on storage.objects;
create policy carga_fotos_envio_com_senha on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'carga-fotos' and public.carga_foto_ticket(name, 'upload'));
create policy carga_fotos_exclusao_com_senha on storage.objects for delete to anon, authenticated
  using (bucket_id = 'carga-fotos' and public.carga_foto_ticket(name, 'delete'));
