# Projeto 1 — SaaS Multi-Tenant com Billing

## FASE 1 — Definição e Escopo

---

## O Problema Real

A maioria dos devs define o problema do SaaS multi-tenant como _"vários usuários usando o mesmo sistema"_. Isso está errado — isso é só autenticação.

O problema real é **isolamento com eficiência**: como você serve múltiplos clientes (tenants) numa infraestrutura compartilhada, garantindo que os dados de um nunca vazem para outro, que um tenant com alto volume não degrada a experiência de outro, e que você consegue cobrar de forma diferenciada por uso — tudo isso sem multiplicar sua infraestrutura linearmente.

O projeto é uma **plataforma de gestão de projetos B2B** (Notion/Linear simplificado). Escolha justificada: domínio rico o suficiente para forçar decisões complexas (hierarquia de permissões, dados por workspace, limites por plano), sem ser abstrato a ponto de virar exercício sem substância.

Cada tenant é uma **organização** (empresa ou time). Cada organização tem membros, projetos e tarefas. O billing controla quantos membros e projetos cada organização pode ter.

---

## Requisitos Funcionais

### Gestão de Tenants

- Criar organização (tenant) via signup
- Convidar membros para a organização por e-mail
- Papéis dentro da organização: `owner`, `admin`, `member`
- Um usuário pode pertencer a múltiplas organizações

### Core do Produto

- Criar/editar/arquivar projetos dentro de uma organização
- Criar/editar/mover tarefas dentro de projetos
- Atribuir tarefas a membros
- Comentários em tarefas

### Billing

- Planos: `free` (3 membros, 3 projetos), `pro` (25 membros, projetos ilimitados), `enterprise` (ilimitado)
- Upgrade/downgrade de plano via Stripe
- Trial de 14 dias no plano pro
- Bloqueio explícito de ações quando limite do plano é atingido (erro retornado, não falha silenciosa)
- Webhook do Stripe para sincronizar estado do billing

### Auth

- Registro/login com e-mail + senha
- Login com Google (OAuth)
- JWT com refresh token rotation

---

## Requisitos Não Funcionais

### Isolamento de Dados

- Nenhuma query pode retornar dados de outro tenant — nem por bug, nem por race condition
- Isolamento garantido em nível de banco, não apenas em nível de aplicação

### Performance

- Queries de listagem (projetos, tarefas) com p99 < 200ms para tenants com até 10k tarefas
- Sem degradação cruzada entre tenants (tenant com alto volume não afeta outros)

### Consistência do Billing

- Estado do billing no banco deve estar sempre sincronizado com Stripe
- Falha no webhook não pode deixar tenant em estado inconsistente permanentemente

### Segurança

- Token válido de um tenant nunca pode acessar recursos de outro tenant
- Rate limiting por tenant (não só por IP)

### Observabilidade

- Toda requisição deve ter `tenant_id` e `user_id` nos logs
- Queries lentas (> 100ms) devem ser logadas com o SQL correspondente

---

## Limitações Reais que Guiam as Decisões

Estas limitações não são artificiais — cada uma força uma decisão arquitetural específica na Fase 2.

| Limitação                                              | Impacto na Arquitetura                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| Infraestrutura compartilhada (não um banco por tenant) | Força RLS ou discriminator column com proteção extra             |
| Stripe como source of truth de billing                 | Banco local é cache — precisa de estratégia de sincronização     |
| Um único deploy (não microserviços)                    | Modularidade interna obrigatória para não virar monólito caótico |
| Sem equipe de SRE                                      | Observabilidade tem que ser simples e automática, não manual     |
| Custo de infra baixo no início                         | PostgreSQL gerenciado, Redis single node, sem Kafka              |

---

## Fora do Escopo (e por quê)

| O que não será feito                        | Motivo                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sharding por tenant                         | Decisão de escala para quando um tenant fica enorme; requer migração de dados, não cabe aqui              |
| Microserviços                               | Modulação interna sim, serviços separados não — complexidade operacional não justificada no estágio atual |
| Fila de mensagens externa (Kafka, RabbitMQ) | Coberto no Projeto 3 (event-driven); aqui usaremos BullMQ + Redis para jobs async pontuais                |

---
