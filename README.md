# FrotaTB — Controle de Frota

App inicial para controle de frota criado em React + Vite + TypeScript.

## O que já tem

- Painel com resumo da frota.
- Cadastro de veículos.
- Cadastro de motoristas.
- Registro de abastecimentos.
- Registro de manutenções.
- Alertas de próxima revisão por quilometragem.
- Custo total por veículo.
- Histórico de lançamentos recentes.
- Backup em JSON.
- Dados salvos no navegador com `localStorage`.

## Como rodar localmente

```bash
npm install
npm run dev
```

Depois abra o endereço exibido pelo Vite no navegador.

## Como gerar build

```bash
npm run build
npm run preview
```

## Próximo passo recomendado

A versão atual funciona sem banco para validar a ideia. Para virar sistema real de equipe, o próximo passo é adicionar:

1. Login de usuários.
2. Banco de dados Supabase.
3. Tabelas de veículos, motoristas, abastecimentos e manutenções.
4. Controle de permissões por empresa.
5. Upload de documentos, fotos e comprovantes.
6. Relatórios por mês, por veículo e por motorista.

## Stack

- React
- TypeScript
- Vite
- CSS puro
