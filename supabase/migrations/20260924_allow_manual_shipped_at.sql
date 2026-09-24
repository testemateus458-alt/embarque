-- Permite corrigir a data real de finalização de uma carga já concluída.
create or replace function public.shipment_before_update() returns trigger
 language plpgsql set search_path = '' as $$
begin
 new.version := old.version + 1;
 new.created_at := old.created_at;
 new.updated_at := now();
 new.started_at := old.started_at;
 if new.status='Em processo' and (old.started_at is null or old.status='Concluído') then new.started_at:=now(); end if;
 if new.status='Pendente' then new.started_at:=null; end if;
 if new.status='Concluído' then
  new.shipped_at:=coalesce(new.shipped_at,old.shipped_at,now());
 else
  new.shipped_at:=null;
 end if;
 return new;
end $$;

create or replace function public.shipment_before_insert() returns trigger
 language plpgsql set search_path='' as $$
begin
 new.version:=1; new.created_at:=now(); new.updated_at:=now();
 new.started_at:=case when new.status='Em processo' then now() else null end;
 new.shipped_at:=case when new.status='Concluído' then coalesce(new.shipped_at,now()) else null end;
 return new;
end $$;
