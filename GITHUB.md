# Subir o Packem no GitHub

## Arquivos que entram no repositório

Envie toda a pasta do projeto, incluindo `app`, `components`, `lib`, `public`,
`supabase`, `tests`, `package.json`, `package-lock.json`, `README.md`,
`vercel.json` e `netlify.toml`.

O `.gitignore` já exclui dependências, arquivos temporários, builds, ZIPs e
variáveis privadas. Não envie `.env.local` nem qualquer chave do Supabase.

## Comandos

Crie um repositório vazio no GitHub. Na pasta do projeto, execute:

```powershell
git add .
git commit -m "Central de expedição Packem"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/packem-expedicao.git
git push -u origin main
```

Troque `SEU-USUARIO/packem-expedicao` pelo endereço do repositório criado.

## Depois de enviar

1. Conecte o repositório à Vercel ou Netlify.
2. Adicione as variáveis do arquivo `.env.example` no painel da hospedagem.
3. No Supabase, rode [`supabase/schema.sql`](./supabase/schema.sql).
4. Configure o domínio publicado em **Authentication > URL Configuration** no
   Supabase.

O arquivo `README.md` contém a documentação técnica do sistema e
`supabase/CONFIGURAR_SUPABASE.md` contém a configuração detalhada do banco.
