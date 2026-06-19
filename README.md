# Controle de Frota Tracbel

Aplicação interna para controle de frota usando React + Vite + TypeScript + Supabase.

## O que já tem

- Dashboard visual com gráficos interativos.
- Filtro por filial.
- Filtro por status do veículo.
- Busca por placa, modelo, categoria e condutor.
- Tema claro e tema escuro.
- Exportação para Excel `.xlsx`.
- Cadastro de filiais.
- Cadastro de veículos com filial, dono/locadora, placa, marca, modelo, ano, KM atual, próxima revisão e status.
- Cadastro de condutores com filial, CNH, categoria, vencimento e contato.
- Cadastro de donos, empresas ou locadoras.
- Atualização de quilometragem/odômetro.
- Registro de manutenções com status aberta, concluída ou cancelada.
- Alertas de revisão por quilometragem.
- Histórico recente de KM e manutenções.
- Dados salvos no Supabase.

## Removido

- A tela de abastecimento foi removida da interface.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o arquivo `supabase/schema.sql`.
4. Rode `supabase/002_fix_vehicle_costs_view.sql`.
5. Rode `supabase/003_filiais_design.sql`.
6. Rode `supabase/004_liberar_rls_uso_interno.sql` se aparecer erro de Row Level Security.
7. Copie a URL do projeto e a anon public key.
8. Configure as variáveis na Vercel ou no `.env.local`.

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

## Corrigir erro de RLS

Se aparecer a mensagem abaixo ao cadastrar filial, veículo, condutor ou manutenção:

```txt
new row violates row-level security policy
```

Rode este arquivo no Supabase SQL Editor:

```sql
supabase/004_liberar_rls_uso_interno.sql
```

## Como rodar localmente

```bash
npm install
npm run dev
```

## Como gerar build

```bash
npm run build
npm run preview
```

## Observação importante

Este projeto está configurado para uso interno simples, sem login e sem SaaS. A anon key do Supabase fica no frontend. Se o link for público ou se houver dados sensíveis, o ideal é adicionar autenticação e Row Level Security antes de usar em produção aberta.

## Stack

- React
- TypeScript
- Vite
- Supabase
- XLSX
- CSS puro
