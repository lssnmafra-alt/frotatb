# FrotaTB — Controle Interno de Frota

Aplicação interna para controle de frota usando React + Vite + TypeScript + Supabase.

## O que já tem

- Painel simples da frota.
- Cadastro de veículos com dono/locadora, placa, marca, modelo, ano, KM atual, próxima revisão e status.
- Cadastro de condutores com CNH, categoria, vencimento e contato.
- Cadastro de donos, empresas ou locadoras.
- Atualização de quilometragem/odômetro.
- Registro de abastecimentos.
- Registro de manutenções com status aberta, concluída ou cancelada.
- Alertas de revisão por quilometragem.
- Histórico recente de KM, abastecimentos e manutenções.
- Dados salvos no Supabase.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o arquivo `supabase/schema.sql`.
4. Rode também `supabase/002_fix_vehicle_costs_view.sql` para garantir a view de custos atualizada.
5. Copie a URL do projeto e a anon public key.
6. Configure as variáveis na Vercel ou no `.env.local`.

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
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
- CSS puro
