# Configuração do Supabase — Packem Embarque

O site **não tem mais login**. Qualquer pessoa que abrir o endereço vê os
embarques, os indicadores e as fotos, atualizados em tempo real.
Para **adicionar, editar, excluir, mover situação, enviar/remover fotos ou
importar romaneio** é preciso clicar em **Liberar edição** e digitar a senha
de edição. Ela fica guardada naquele navegador até alguém clicar em
**Bloquear edição**.

## Como a proteção funciona

- A leitura é pública (RLS com `select` para `anon`).
- Ninguém grava direto nas tabelas: `insert/update/delete` foram revogados.
- Toda gravação passa pelas funções `public.edit_*` (RPC, `security definer`),
  que conferem a senha com o hash bcrypt em `private.edit_secret`
  (esquema não exposto pela API). Senha errada espera 1,5 s e é recusada.
- Fotos: `edit_photo_upload_ticket` libera o envio de um arquivo por 10 min;
  `edit_delete_photo` libera a exclusão do arquivo. Sem isso o Storage recusa.
- Tempo real: `shipments`, `shipment_photos`, `audit_log` e `docks` estão na
  publicação `supabase_realtime`.

## Projeto novo

1. **SQL Editor > New query**: cole [`schema.sql`](./schema.sql) e rode uma vez.
2. Na hospedagem do site, configure:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Nunca use a chave `service_role` no site.

## Projeto existente

Aplique, nesta ordem, as migrações de [`migrations/`](./migrations):

1. `20261109120000_leitura_publica_e_senha_de_edicao.sql` — pode ir antes do
   deploy (não quebra o site antigo).
2. Publique o novo site.
3. `20261109120100_bloquear_escrita_direta.sql` — logo após o deploy (a partir
   daí o site antigo não consegue mais gravar).

## Trocar a senha de edição

```sql
update private.edit_secret
set password_hash = extensions.crypt('NOVA_SENHA', extensions.gen_salt('bf', 10)),
    updated_at = now()
where id = 1;
```

Os navegadores com a senha antiga passam a ver "Senha de edição inválida" e
precisam digitar a nova.
