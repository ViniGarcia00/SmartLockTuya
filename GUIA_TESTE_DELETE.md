# 🧪 Guia Prático: Testando o Botão Deletar Senhas

## ✅ Pré-requisitos

- [ ] Servidor Node.js rodando (`npm start`)
- [ ] PostgreSQL conectado
- [ ] Credenciais Tuya configuradas no sistema
- [ ] Pelo menos uma fechadura cadastrada
- [ ] Pelo menos uma senha temporária criada

---

## 📝 Passo 1: Verificar Configuração Básica

### 1.1 - Verificar se o servidor está rodando
```powershell
# Terminal PowerShell
curl http://localhost:3000
```
**Resultado esperado:** Redirecionamento para `/dashboard.html`

### 1.2 - Verificar localStorage do navegador
```javascript
// Console do navegador (F12 → Console)
console.log(localStorage.getItem('token'));
console.log(localStorage.getItem('currentLockId'));
```
**Resultado esperado:**
- `token`: Uma string JWT longa
- `currentLockId`: O ID de uma fechadura (ex: `123456`)

---

## 🔍 Passo 2: Testar Carregamento da Página

### 2.1 - Abrir página de passwords
```
URL: http://localhost:3000/passwords.html?lockId=SEU_ID_AQUI
```

### 2.2 - Verificar se currentLockId foi salvo
```javascript
// Console
console.log('currentLockId:', currentLockId);
console.log('localStorage.currentLockId:', localStorage.getItem('currentLockId'));
```

**Resultado esperado:** Ambos devem mostrar o mesmo ID da fechadura

### 2.3 - Recarregar página (F5) e verificar novamente
```javascript
// Console (após recarregar)
console.log('localStorage.currentLockId:', localStorage.getItem('currentLockId'));
```

**Resultado esperado:** O valor deve ser mantido após recarregar

---

## 🚀 Passo 3: Fazer Teste Manual de Deleção

### 3.1 - Abrir Console (F12)
- Pressionar `F12`
- Ir para aba **Console**
- Ir para aba **Network** (vai ajudar a ver as requisições)

### 3.2 - Clique no botão "🗑️ Deletar" de uma senha

### 3.3 - Confirmar o diálogo de confirmação
```
"Deseja deletar esta senha?"
→ Clique em "OK"
```

### 3.4 - Observar Console
Procure por logs como:

```
🗑️ Deletando senha: 12345
🔑 Usando deviceId: 67890
💾 localStorage.currentLockId: 67890
📍 URL da requisição: http://localhost:3000/api/device/67890/temp-password/12345
📋 Headers: {Content-Type: "application/json", Authorization: "Bearer eyJ..."}
📊 Status HTTP: 200
📝 Response OK: true
📝 Response statusText: OK
✅ Resposta do servidor: {success: true, message: "Senha deletada com sucesso", result: {...}}
🎉 Senha deletada com sucesso!
```

### 3.5 - Observar Network
- Procure por uma requisição `DELETE` para `/api/device/.../temp-password/...`
- Status deve ser **200** ou **204**
- Response deve conter `{"success": true}`

---

## ❌ Troubleshooting

### Problema 1: "❌ Erro: Fechadura não selecionada"

**Causa:** `currentLockId` não está definido

**Solução:**
```javascript
// Console
localStorage.setItem('currentLockId', '12345'); // Substitua 12345 pelo ID real
location.reload();
```

### Problema 2: "❌ Configure suas credenciais Tuya antes de continuar"

**Causa:** Usuário não tem credenciais Tuya configuradas

**Solução:**
1. Ir para **Configurações** → **Credenciais Tuya**
2. Preencher com dados corretos
3. Salvar
4. Voltar para página de senhas

### Problema 3: Status 404 ou 500

**Causa:** Problemas com API Tuya

**Solução:**
1. Verificar logs no servidor (terminal)
2. Procurar por "❌ DELETE" nos logs
3. Verificar se `deviceId` e `passwordId` estão corretos
4. Verificar se credenciais Tuya estão válidas

### Problema 4: Resposta vazia ou sem JSON

**Causa:** API Tuya retornou status 204 (No Content) sem body

**Solução:**
- ✅ Isto é NORMAL! O código foi melhorado para lidar com isso
- A senha foi deletada com sucesso mesmo assim
- A interface deve mostrar alerta de sucesso

---

## 📊 Script Automático de Teste

### Usando o arquivo `test-delete-password.js`

1. **Abrir Console (F12)**
2. **Copiar conteúdo de `test-delete-password.js`**
3. **Colar no console**
4. **Pressionar Enter**

Será executado um diagnóstico completo com recomendações.

---

## 🔧 Teste Direto via cURL

Se preferir testar direto do PowerShell:

```powershell
# Substitua:
# - $token = seu JWT
# - $deviceId = ID da fechadura
# - $passwordId = ID da senha

$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
$deviceId = "123456"
$passwordId = "987654"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$url = "http://localhost:3000/api/device/$deviceId/temp-password/$passwordId"

Invoke-WebRequest -Uri $url -Method DELETE -Headers $headers -UseBasicParsing | ConvertTo-Json
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Senha deletada com sucesso",
  "result": { ... }
}
```

---

## 📋 Checklist de Verificação

Antes de considerar "pronto", verificar:

- [ ] Página carrega corretamente
- [ ] `currentLockId` é carregado do URL ou localStorage
- [ ] Recarregar página mantém `currentLockId`
- [ ] Botão deletar mostra confirmação
- [ ] Após confirmar, requisição é enviada
- [ ] Console mostra logs detalhados
- [ ] Network mostra status 200 ou 204
- [ ] Response contém `{"success": true}`
- [ ] Alerta de sucesso é exibido
- [ ] Senha desaparece da lista
- [ ] Erros de Tuya são tratados corretamente

---

## 🎯 Resumo das Mudanças

| O que foi mudado | Por quê | Resultado |
|------------------|--------|-----------|
| Salvar currentLockId no localStorage | Persistência entre recarregos | Botão funciona após recarregar |
| Adicionar validação de parâmetros no backend | Evitar requisições inválidas | Melhor debugging |
| Melhorar tratamento de status codes | Tuya retorna vários status | Reconhece sucesso em 200, 204, 404 |
| Padronizar resposta JSON | Facilitar parsing no frontend | Frontend sabe sempre o que esperar |
| Adicionar logging detalhado | Facilitar debugging | Mensagens claras no console |

---

## 💡 Dicas Úteis

### Ver todos os localStorage
```javascript
console.table(localStorage);
```

### Ver headers que serão enviados
```javascript
console.log(getHeaders());
```

### Testar URL manualmente
```javascript
console.log(`URL: http://localhost:3000/api/device/${currentLockId}/temp-password/SENHA_ID`);
```

### Limpar console
```javascript
clear();
```

---

**Última atualização:** Outubro 21, 2025
**Responsável:** GitHub Copilot - SmartLock Tuya
