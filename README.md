# 💰 Minhas Finanças

Aplicação web (PWA) de **controle financeiro pessoal** e **dias trabalhados**, com autenticação, gráficos, backup e funcionamento offline.

> 🚀 **Aplicação online:** https://minhafinancia.netlify.app/

<!-- 📸 Adicione aqui 1 ou 2 capturas de tela (veja a seção "Telas" mais abaixo) -->

---

## 📌 Sobre o projeto

Eu precisava de um jeito de acompanhar três coisas ao mesmo tempo: **quanto gastei**, **quanto recebi** e **quantos dias trabalhei para cada patrão**. Este app resolve isso em um só lugar, com login e dados salvos em banco.

O diferencial é o **ciclo financeiro personalizado**: em vez de seguir o mês do calendário, o usuário define o dia de início do ciclo (ex.: dia 15) e o sistema calcula automaticamente o fechamento, separando o que pertence a cada ciclo.

## ✅ Funcionalidades

**Autenticação**
- Login, cadastro e recuperação de senha
- Sessão persistida com renovação automática de token

**Gastos**
- Cadastro com 9 categorias, busca e filtro
- Edição e exclusão de lançamentos
- Lista ordenada por data (mais recentes primeiro)

**Ciclo financeiro**
- Dia de início configurável (1 a 28)
- Cálculo automático do fechamento do ciclo
- Navegação entre ciclos (anterior / próximo)

**Métricas e gráficos**
- Total recebido, total gasto e saldo do ciclo
- Comparativo com o ciclo anterior
- Gráfico de evolução dos últimos 6 ciclos
- Gráfico de distribuição por categoria

**Trabalho e pagamentos**
- Cadastro de patrões
- Registro de dias trabalhados (dia único ou vários via calendário)
- Dar baixa de pagamento, com histórico arquivado por ciclo

**Outros**
- Exportar e importar backup em `.json`
- Funcionamento offline com cache local (`LocalStorage`)
- Instalável como aplicativo (PWA)

## 🛠️ Tecnologias

| Área | Tecnologia |
|---|---|
| Estrutura | HTML5 |
| Estilos | CSS3 (variáveis CSS, Flexbox, Grid, responsivo) |
| Lógica | JavaScript (puro, sem frameworks) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Gráficos | Chart.js |
| Armazenamento local | LocalStorage |
| Offline / instalação | Service Worker + Web App Manifest (PWA) |
| Hospedagem | Netlify |
| Versionamento | Git + GitHub |

## 📁 Estrutura do projeto

```
controle-financeiro/
├── index.html            # Estrutura da página e IDs usados pelo JS
├── css/
│   └── style.css         # Todo o estilo (variáveis, layout, responsivo)
├── js/
│   ├── supabase.js       # Conexão com o banco
│   ├── auth.js           # Login, cadastro, recuperação, logout
│   ├── gastos.js         # Ciclo, métricas, gráficos e CRUD de gastos
│   ├── trabalho.js       # Patrões e calendário de dias trabalhados
│   ├── pagamentos.js     # Dar baixa, histórico e painel do patrão
│   ├── backup.js         # Exportar, importar e carregar dados
│   └── app.js            # Núcleo: configuração, estado, inicialização e PWA
├── manifest.json         # Configuração do app instalável
├── sw.js                 # Service Worker (cache offline)
├── _redirects            # Rotas do Netlify
├── atualizar-senha.html  # Página de redefinição de senha
└── icon-192.png / icon-512.png
```

## 🚀 Como executar

Basta abrir o `index.html` no navegador. Para testar em modo local (com login automático de desenvolvimento):

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

> ⚠️ Ao abrir o `index.html` direto pelo arquivo (`file://`), o navegador pode bloquear o
> Service Worker. Usar um servidor local resolve.

## 🗄️ Estrutura do banco (Supabase)

| Tabela | Colunas principais |
|---|---|
| `gastos` | `id`, `nome`, `categoria`, `valor`, `data`, `user_id` |
| `patroes` | `id`, `nome`, `user_id` |
| `dias_trabalhados` | `id`, `patrao`, `data`, `valor`, `user_id` |
| `pagamentos` | `id`, `patrao`, `valor`, `dias_count`, `data_pagamento`, `ciclo_inicio`, `ciclo_fim`, `user_id` |

Todas as tabelas filtram por `user_id`, garantindo que cada usuário veja apenas os próprios dados.

## 🧠 Aprendizados

- **Escopo global do JavaScript:** entender por que o projeto usa `<script>` clássicos (e não `type="module"`) — é o que permite manter os eventos `onclick` do HTML funcionando mesmo com o código dividido em vários arquivos.
- **Ordem de carregamento:** o `app.js` centraliza a inicialização e precisa ser o último script carregado, porque a IIFE de inicialização executa imediatamente.
- **Ciclo financeiro** como conceito de negócio, diferente do mês do calendário.
- **Offline-first básico:** Service Worker com estratégia *cache-first* e fallback para rede.

## 👤 Autor

**Wesley Jesus de Souza Campos — 15947**
Curso de Análise e Desenvolvimento de Sistemas (ADS)
Centro Universitário São Lourenço (UNISL)

## 🎓 Objetivo acadêmico

Projeto desenvolvido como atividade acadêmica para aplicar conceitos de desenvolvimento web, versionamento de código com Git e GitHub, e publicação de aplicações utilizando a plataforma Netlify.

**Ano:** 2026

---

## 📸 Telas

<!-- Substitua os caminhos abaixo pelas suas capturas de tela -->
<!--
| Dashboard | Gastos |
|---|---|
| ![Dashboard](docs/dashboard.png) | ![Gastos](docs/gastos.png) |
-->