# Packem — Torre de Embarques

## Atualização: lotes e tempo de carga
O cadastro atual contém lote, unidade, situação e observação obrigatória quando falta item. As abas separam Pendente, Em processo, Falta item e Concluído, com até 12 registros por página. O lote é único; edições mantêm o identificador do registro.

O tempo começa ao entrar em Em processo e termina ao concluir. A espera por material faz parte do tempo total. Retomar após falta de item preserva o início; reabrir uma carga concluída inicia um novo ciclo. Concluir um lote que nunca foi iniciado não inventa duração. Em produção, os horários são definidos pelos triggers do banco. Use o schema atualizado em um projeto novo; não execute novamente sobre um banco existente sem preparar uma migração.

Sem Supabase configurado, o ambiente é demonstração: alterações ficam na memória desta página e não são sincronizadas entre dispositivos. O cronômetro da tela funciona, mas isso não significa conexão com um banco real. Os testes de tempo podem ser executados com `node --test --test-isolation=none tests/timing.test.mjs` em Node 24.

App web em português, com identidade Packem, painel operacional responsivo, seis etapas de Kanban, docas, fila, cadastro de cargas, filtros, auditoria, modo TV e integração Supabase.

## Ambiente
Node.js 22.13+ e npm. O projeto usa React + Next.js (Vinext para Sites). A interface utiliza os componentes acessíveis Radix/Shadcn e Lucide.

## Executar
1. Rode `npm run install:ci`.
2. Copie `.env.example` para `.env.local`.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Rode `npm run dev` e abra o endereço exibido.
Sem configuração, abre uma demonstração explicitamente identificada, com dados fictícios em memória. Alterações da demonstração são descartadas ao recarregar. Não use esse modo como registro de operação.

## Supabase/Postgres
1. Crie um projeto Supabase e execute `supabase/schema.sql` no SQL Editor, uma vez em banco novo.
2. Em Authentication > Users, crie os usuários da equipe. O app não permite cadastro público. Desative novas inscrições no painel Supabase.
3. Cada usuário novo recebe perfil **visualizador**.
4. Promova o primeiro administrador no SQL Editor:
   `update public.profiles set role='admin' where id='UUID_DO_USUARIO';`
5. Entre no app com e-mail e senha. Na aba Equipe, o administrador altera os perfis e ativa/desativa usuários.
6. Use apenas a chave pública anon/publishable no frontend. Nunca informe service_role.
7. Configure as URLs autorizadas em Authentication > URL Configuration para o domínio final.
8. A migração inclui as tabelas na publicação supabase_realtime. Verifique a ativação em Database > Replication.

Perfis:
- Visualizador: leitura de cargas, docas e auditoria.
- Operador: leitura, cadastro, edição e movimentação.
- Admin: todas as anteriores, exclusão e gestão de perfis.
As políticas RLS protegem o banco, independentemente dos botões exibidos. Um perfil inativo perde acesso aos dados. A auditoria é gerada por trigger e clientes não podem alterá-la.

## Regras operacionais
- Atrasada: previsão anterior ao horário atual e ainda não embarcada. Atualização a cada segundo.
- Data/filtros afetam KPIs, fluxo e fila. Docas mostram toda ocupação ativa, inclusive de outro dia.
- Doca ocupada durante Em Carregamento ou Conferência. Restrição única do banco impede duas cargas simultâneas.
- Embarcar libera a doca e registra a hora de saída no banco.
- Edição usa controle de versão: alterações concorrentes não sobrescrevem silenciosamente uma à outra.
- Realtime atualiza telas conectadas; recarga periódica e reconexão recuperam eventos perdidos.
- O modo TV oculta controles de edição, pode entrar em tela cheia e mantém relógio e dados atualizados.
- Uma instalação corresponde a uma operação/equipe. Não há isolamento multiempresa.

## Deploy em Vercel
Importe o repositório. Framework: Next.js. Install command: `npm run install:ci`; Build command: `npm run build:next`. Configure as duas variáveis NEXT_PUBLIC antes do build. O projeto inclui vercel.json. Para executar o build localmente use `npm run build:next`.

## Deploy em Netlify
Importe o repositório. O netlify.toml configura build Next.js. Use Node 22+ e configure as duas variáveis de ambiente no painel. A integração oficial Next.js da Netlify é detectada automaticamente.

## Sites
O build padrão `npm run build` usa Vinext e gera Worker compatível com Sites/Cloudflare. Preserve .openai/hosting.json e o plugin Sites no vite.config.ts. Uma publicação de demonstração não provisiona um banco Supabase.

## Verificação
`npm run typecheck` e `npm test`.
Depois de configurar Supabase, valide com contas dos três perfis:
- Visualizador não pode inserir/editar/excluir, nem chamando a API diretamente.
- Operador cadastra e move, mas não exclui nem promove perfis.
- Admin exclui e gerencia perfis.
- Em dois navegadores, alterações aparecem em ambos; editar uma versão antiga retorna conflito.
- Duas cargas não podem ocupar a mesma doca.
- Criar/editar/excluir gera auditoria e não é possível alterar a auditoria pelo cliente.
Esses testes de integração exigem um projeto Supabase real; não são substituídos pelos testes locais.

Documentação: https://supabase.com/docs/guides/realtime/postgres-changes e https://supabase.com/docs/guides/database/postgres/row-level-security.
