# Configuração do Supabase — Packem

## 1. Criar o banco

No Supabase, abra **SQL Editor > New query**, cole todo o conteúdo de
[`schema.sql`](./schema.sql) e clique em **Run**. Execute uma única vez em um
projeto novo. Esse arquivo cria as tabelas, auditoria, permissões, perfis e
atualização em tempo real.

## 2. Criar o primeiro acesso

Abra **Authentication > Users > Add user > Create new user** e informe o
e-mail e a senha do responsável pelo sistema. Depois, no **SQL Editor**, rode:

```sql
update public.profiles
set role = 'admin'
where id = 'COLE_AQUI_O_UUID_DO_USUARIO';
```

O UUID fica na coluna **ID** do usuário criado em Authentication > Users.

## 3. Criar os demais usuários

Crie cada pessoa em **Authentication > Users**. Todo novo usuário entra como
`visualizador`. O administrador altera para `operador` ou `admin` pela tela
**Equipe** do sistema.

Em **Authentication > Providers > Email**, deixe o cadastro público
desativado. Assim, somente a administração cria novos acessos.

## 4. Pegar as chaves do projeto

Abra **Project Settings > API** e copie apenas:

- Project URL
- Publishable key (ou a chave `anon`)

Nunca use a chave `service_role` no site.

## 5. Ligar o sistema ao banco

No servidor onde o site será publicado, adicione as duas variáveis abaixo
com os valores copiados no passo anterior:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

O modelo pronto está em [`.env.example`](../.env.example). Essas variáveis não
são coladas no SQL Editor; elas ficam na configuração do site hospedado.

## 6. Autorizar o endereço do site

Depois de publicar, abra **Authentication > URL Configuration** e informe:

- Site URL: endereço público do sistema
- Redirect URLs: o mesmo endereço e, se necessário, o endereço local de teste

O script já coloca cargas, docas, perfis e auditoria no Realtime. Após salvar
as variáveis e publicar o site, as alterações feitas por uma pessoa aparecerão
para as outras em tempo real.
