# LGPD - Lei Geral de Proteção de Dados

## Conformidade de Dados Pessoais

Este documento descreve as práticas de conformidade com a **LGPD (Lei Geral de Proteção de Dados)** e princípios equivalentes de proteção de dados (como GDPR) implementadas no SmartLockTuya.

---

## 1. Política de Retenção de Dados

### 1.1 Logs e Dados de Auditoria

| Tipo de Dados | Período de Retenção | Justificativa |
|---|---|---|
| **Logs de autenticação** | 30 dias | Auditoria de segurança e detecção de fraudes |
| **Logs de alteração de PINs** | 90 dias | Conformidade regulatória e investigações |
| **Logs de acesso a API** | 30 dias | Segurança e troubleshooting |
| **Logs de sincronização** | 14 dias | Resolução de problemas operacionais |
| **Histórico de reservas** | 2 anos | Requisitos legais e fiscais |
| **Dados de configuração** | Ativo + 30 dias pós-deleção | Recuperação de dados |

### 1.2 Dados Pessoais dos Usuários

| Tipo de Dado | Retenção | Política |
|---|---|---|
| **Email** | Ativo | Mantido enquanto conta ativa |
| **Hash de senha/PIN** | Ativo | Nunca é recuperável (hashed com bcrypt) |
| **Histórico de atividades** | 30 dias | Logs sanitizados após 30 dias |
| **Dados de contato** | Ativo | Removido após exclusão de conta |
| **IP de login** | 14 dias | Auditoria de segurança |

### 1.3 Dados de Hospedes (Guests)

| Tipo de Dado | Retenção | Política |
|---|---|---|
| **Nome do hóspede** | Duração da reserva | Nunca salvo em logs |
| **Email do hóspede** | Duração da reserva | Hash criptografado, nunca em plaintext |
| **PIN temporário** | Até 30 dias pós-expiração | Descartado após revogação |
| **Log de PIN gerado** | 30 dias | Mascarado nos logs |

---

## 2. Direitos dos Titulares de Dados

### 2.1 Direito de Acesso
Os usuários têm direito de solicitar:
- **Cópia de todos os seus dados** armazenados no sistema
- **Histórico de acessos** realizados por terceiros
- **Relatório de processamento** de dados pessoais

**Implementação:**
```javascript
// Endpoint: GET /api/user/data-export
// Retorna arquivo JSON com todos os dados do usuário
// Sanitizado de dados sensíveis de terceiros
```

### 2.2 Direito de Retificação
Os usuários podem:
- **Corrigir dados pessoais** (nome, email, telefone)
- **Atualizar preferências** de privacidade
- **Solicitar correção de erros** nos registros

**Implementação:**
```javascript
// Endpoint: PUT /api/user/profile
// Atualiza dados com validação e auditoria
// Log: "User {id} updated profile fields: {list}"
```

### 2.3 Direito de Exclusão ("Direito ao Esquecimento")
Os usuários podem solicitar:
- **Exclusão de conta** e todos seus dados pessoais
- **Remoção de histórico** de atividades
- **Limpeza de dados** em 30 dias (período de caução)

**Implementação:**
```javascript
// Endpoint: DELETE /api/user/account
// 1. Marca conta para exclusão (soft-delete)
// 2. Aguarda 30 dias de período de caução
// 3. Após 30 dias: hard-delete de todos os dados
// 4. Mantém logs de auditoria por 90 dias
```

**Dados que PODEM ser retidos após exclusão:**
- Logs de auditoria anonimizados (sem ID do usuário)
- Dados agregados de análise (totais, estatísticas)
- Registros de conformidade legal

### 2.4 Direito de Portabilidade
Os usuários podem:
- **Exportar dados** em formato estruturado (JSON/CSV)
- **Transferir dados** para outro serviço
- **Receber cópia** do contrato/configurações

**Implementação:**
```javascript
// Endpoint: GET /api/user/export
// Formatos: JSON, CSV, PDF
// Inclui: Reservas, Configurações, Histórico
// Exclui: Dados de hóspedes de outros usuários
```

### 2.5 Direito de Oposição
Os usuários podem:
- **Opr-out de análise** de dados
- **Recusar processamento** de dados não-essenciais
- **Solicitar remoção** de listas de contato

**Implementação:**
```javascript
// Endpoint: POST /api/user/preferences
// Opções:
// - analytics_enabled: boolean
// - email_marketing: boolean
// - data_sharing: boolean
```

---

## 3. Medidas de Segurança

### 3.1 Encriptação de Dados

#### PINs
- **Algoritmo:** bcrypt com 12 rounds
- **Recuperação:** ❌ Impossível (função unidirecional)
- **Implicação:** Usuário não pode recuperar PIN anterior
- **Segurança:** Resistente a force brute attacks

```typescript
// Exemplo de hashing de PIN
const hashedPin = await bcrypt.hash('1234567', 12);
// $2b$12$... (impossível reverter)
```

#### Emails
- **Algoritmo:** SHA256 + salt
- **Uso:** Identificação LGPD (hashing de contato)
- **Recuperação:** ❌ Impossível
- **Formato:** Base64 encoded

```typescript
// Exemplo de hashing de email
const emailHash = hashEmail('user@example.com');
// 7x8k9l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8
```

#### Senhas
- **Algoritmo:** PBKDF2 com 100.000 iterações
- **Força:** 256-bit (32 bytes)
- **Salt:** Gerado aleatoriamente por usuário
- **Recuperação:** ❌ Impossível

### 3.2 Sanitização de Logs

**Nunca são loggados:**
- PINs em plaintext
- Senhas em qualquer formato
- Emails de hóspedes
- Nomes de usuários/hóspedes
- Tokens de autenticação
- Headers de Authorization
- Cookies de sessão

**Exemplo de Log Sanitizado:**
```json
{
  "requestId": "uuid-1234-5678",
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "PIN gerado para reserva",
  "data": {
    "reservationId": "res-123456",
    "pin": "[REDACTED: 7 digits]",
    "expiresAt": "2024-01-16T10:30:00Z",
    "guestName": "[REDACTED]"
  }
}
```

### 3.3 Validação de Configuração

**Variáveis de ambiente críticas** são validadas no startup:
- `STAYS_CLIENT_SECRET` (obrigatória em produção)
- `REDIS_URL` (obrigatória para cache)
- `JWT_SECRET` (obrigatória para tokens)
- `DATABASE_URL` (obrigatória para persistência)

**Se faltar alguma variável crítica:**
- ❌ Aplicação não inicia
- 🔴 Erro claro indicando qual variável falta
- 📝 Mensagem com link para documentação

### 3.4 Autenticação

- **Tokens JWT** com expiração de 24 horas
- **Renovação automática** de tokens expirados
- **Invalidação de sessão** ao logout
- **Rate limiting** para prevenção de força bruta
- **CSRF protection** em requisições state-changing

### 3.5 Autorização

- **Role-based access control** (RBAC)
- **Admin routes** requerem autenticação e permissão
- **Isolamento de dados** por usuário/organização
- **Auditoria de acesso** a dados sensíveis

---

## 4. Conformidade com Princípios LGPD

### 4.1 Princípio da Transparência
✅ **Conformidade:**
- Política de privacidade clara e acessível
- Documentação de coleta de dados
- Notificação em caso de violação (72 horas)
- Relatórios periódicos disponíveis

### 4.2 Princípio da Necessidade
✅ **Conformidade:**
- Coleta apenas dados necessários para reservas
- Sem rastreamento excessivo
- Dados de hóspedes não persistidos além da reserva
- Logs descartados após 30-90 dias

### 4.3 Princípio da Segurança
✅ **Conformidade:**
- Encriptação em trânsito (HTTPS/TLS)
- Encriptação em repouso (bcrypt, SHA256)
- Validação de entrada (prevenção de SQL injection)
- Headers de segurança (CSP, X-Frame-Options, HSTS)

### 4.4 Princípio de Acesso
✅ **Conformidade:**
- Usuários acessam seus próprios dados
- Isolamento de dados entre usuários
- Acesso diferenciado por função (admin/user)
- Logs de auditoria de acesso

### 4.5 Princípio da Finalidade
✅ **Conformidade:**
- Dados usados apenas para gerenciar reservas
- Não compartilhados com terceiros sem consentimento
- Processamento transparente
- Retenção limitada no tempo

### 4.6 Princípio da Integridade
✅ **Conformidade:**
- Validação de integridade em transferências
- Proteção contra modificação não autorizada
- Backup automático com retenção
- Recuperação de desastres

---

## 5. Processamento de Dados de Terceiros

### 5.1 Dados da Plataforma Stays

- **Coleta:** Nome, email, datas de reserva de hóspedes
- **Armazenamento:** ❌ Nunca em plaintext
- **Processamento:** Exclusivamente para gerar PINs
- **Compartilhamento:** ❌ Nunca com terceiros
- **Retenção:** Duração da reserva + 30 dias

### 5.2 Dados da API Tuya

- **Coleta:** Status de fechaduras, histórico de acesso
- **Compartilhamento:** ❌ Nunca com terceiros
- **Retenção:** 30-90 dias de logs
- **Acesso:** Exclusivo para usuário proprietário

---

## 6. Resposta a Incidentes de Segurança

### 6.1 Procedimento de Notificação

Em caso de violação de dados pessoais:

1. **Imediatamente:** Investigar e confirmar violação
2. **Dentro de 72 horas:** Notificar autoridades competentes
3. **Dentro de 72 horas:** Notificar usuários afetados
4. **Dentro de 30 dias:** Publicar relatório de impacto

### 6.2 Conteúdo da Notificação

- Descrição da violação
- Dados afetados
- Medidas mitigantes tomadas
- Contato para suporte
- Direitos e orientações

### 6.3 Logging de Incidentes

Todos os incidentes são registrados com:
- Timestamp preciso
- IP afetado
- Tipo de violação
- Dados comprometidos
- Ações tomadas

---

## 7. Direitos de Exclusão de Dados

### 7.1 Processo de Deleção

**Fase 1: Requisição (T0)**
- Usuário solicita exclusão de conta
- Sistema marca para soft-delete
- Email de confirmação enviado

**Fase 2: Caução (T0 → T30)**
- Dados mantidos em estado de exclusão
- Usuário pode cancelar em até 30 dias
- Período para cumprir obrigações legais

**Fase 3: Exclusão (T30+)**
- Hard-delete de todos os dados pessoais
- Arquivos descartados de forma segura
- Backups removidos após 90 dias

### 7.2 Dados Retidos Após Exclusão

| Dado | Razão | Duração |
|---|---|---|
| Logs anonimizados | Auditoria | 90 dias |
| Agregação estatística | Análise | Indefinido |
| Registros de conformidade | Legal | 2 anos |
| Hash de email (anônimo) | Prevenção de duplicação | 1 ano |

---

## 8. Auditoria e Monitoramento

### 8.1 Métricas Rastreadas

- Número de usuários deletados por mês
- Requisições de acesso a dados
- Tentativas de acesso não autorizado
- Alterações de permissões
- Eventos de segurança

### 8.2 Logs de Auditoria

Mantidos por 90 dias com:
- Quem? (userId ou sistema)
- O quê? (operação realizada)
- Quando? (timestamp UTC)
- Onde? (IP/origem)
- Por quê? (contexto da operação)

### 8.3 Relatórios

- **Mensal:** Análise de incidentes de segurança
- **Trimestral:** Auditoria de conformidade
- **Anual:** Relatório LGPD abrangente

---

## 9. Contato e Dúvidas

### 9.1 Encarregado de Proteção de Dados (DPO)

Para questões sobre LGPD e privacidade:
- **Email:** dpo@smartlocktya.example.com
- **Telefone:** +55 (XX) XXXXX-XXXX
- **Endereço:** [Endereço da Empresa]

### 9.2 Autoridades

Para denúncias sobre violação de dados:
- **ANPD (Brasil):** https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd
- **Contato:** lgpd@anpd.gov.br

---

## 10. Histórico de Revisão

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2024-01-15 | 1.0 | Documento inicial - PASSO 18 | Copilot |
| - | 1.1 | [Pendente] | [A definir] |

---

## 11. Anexos

### Anexo A: Checklist de Conformidade LGPD

- ✅ Política de privacidade publicada
- ✅ Consentimento coletado para processamento
- ✅ Direito de acesso implementado
- ✅ Direito de retificação implementado
- ✅ Direito de exclusão implementado
- ✅ Direito de portabilidade implementado
- ✅ Dados criptografados em repouso
- ✅ Dados criptografados em trânsito
- ✅ Logs de auditoria implementados
- ✅ Sanitização de dados sensíveis em logs
- ✅ Validação de configuração obrigatória
- ✅ Resposta a incidentes (<72h)
- ✅ Retenção de dados limitada
- ✅ Segregação de dados por usuário

### Anexo B: Referências Normativas

1. **Lei Geral de Proteção de Dados (LGPD)** - Lei nº 13.709/2018
2. **GDPR** - General Data Protection Regulation (EU)
3. **NIST Cybersecurity Framework** - SP 800-53
4. **OWASP Top 10** - Web Application Security Risks

---

**Última Atualização:** 15 de Janeiro de 2024  
**Próxima Revisão:** 15 de Abril de 2024  
**Responsável:** Equipe de Segurança e Conformidade
