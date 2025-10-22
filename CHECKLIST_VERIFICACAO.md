# ✅ Checklist de Verificação - Botão Deletar Senhas

## 📋 Verificação Rápida (5 minutos)

### Pré-requisitos
- [ ] Servidor rodando (`npm start`)
- [ ] PostgreSQL conectado
- [ ] Credenciais Tuya configuradas
- [ ] Pelo menos 1 senha temporária criada

### Teste Básico
- [ ] Abrir `http://localhost:3000/passwords.html?lockId=SEU_ID`
- [ ] Verificar console: `console.log(currentLockId)`
- [ ] Recarregar página (F5)
- [ ] Verificar console novamente: `console.log(localStorage.getItem('currentLockId'))`
- [ ] Ambos devem ser iguais ✅

### Teste do Botão
- [ ] Clicar em "🗑️ Deletar" em uma senha
- [ ] Confirmar diálogo "Deseja deletar esta senha?"
- [ ] Ver alerta verde: "✅ Senha deletada com sucesso!"
- [ ] Senha desaparece da lista
- [ ] Status HTTP na aba Network = 200 ou 204

---

## 🔧 Verificação Técnica (Backend)

### Arquivo: `server.js` - Endpoint DELETE

#### ✅ Linha 321 - Assinatura da rota
```javascript
app.delete('/api/device/:deviceId/temp-password/:passwordId', authenticateToken, requireTuyaConfig, async (req, res) => {
```
- [ ] Usa método HTTP DELETE
- [ ] Tem middleware `authenticateToken`
- [ ] Tem middleware `requireTuyaConfig`
- [ ] Parâmetros `:deviceId` e `:passwordId` presentes

#### ✅ Linha 326-331 - Validação de Parâmetros
```javascript
if (!deviceId || !passwordId) {
  return res.status(400).json({ success: false, error: '...' });
}
```
- [ ] Valida deviceId não vazio
- [ ] Valida passwordId não vazio
- [ ] Retorna status 400 se inválido

#### ✅ Linha 333-336 - Obtenção de Token
```javascript
const accessToken = await ensureToken(req.user.id, req.tuyaConfig);
const url = `/v1.0/devices/${deviceId}/door-lock/temp-passwords/${passwordId}`;
```
- [ ] Obtém token Tuya com cache
- [ ] Constrói URL correta

#### ✅ Linha 345-353 - Requisição DELETE
```javascript
const response = await axios.delete(fullUrl, { headers: { ... } });
res.json({ success: true, result, message: '...' });
```
- [ ] Envia DELETE para Tuya
- [ ] Retorna `{ success: true, ... }` em caso de sucesso

#### ✅ Linha 355-379 - Tratamento de Erros
```javascript
if (err.response?.status === 404 || 
    err.response?.status === 204 ||
    (err.response?.status >= 200 && err.response?.status < 300)) {
  return res.json({ success: true, ... });
}
```
- [ ] Reconhece status 200-299 como sucesso
- [ ] Reconhece status 204 No Content como sucesso
- [ ] Reconhece status 404 como sucesso (Tuya pattern)
- [ ] Retorna resposta consistente

---

## 🎨 Verificação Técnica (Frontend)

### Arquivo: `public/passwords.html`

#### ✅ Linha 394 - Declaração de Variável
```javascript
let currentLockId = null;
```
- [ ] Variável declarada no escopo global

#### ✅ Linha 428-439 - Inicialização
```javascript
currentLockId = params.get('lockId') || localStorage.getItem('currentLockId');
if (currentLockId) {
    localStorage.setItem('currentLockId', currentLockId);
}
```
- [ ] Carrega de URL parameter
- [ ] Fallback para localStorage
- [ ] **Salva no localStorage** (novo!)
- [ ] Valida antes de salvar

#### ✅ Linha 571-619 - Função deletePassword
```javascript
async function deletePassword(passwordId) {
```
- [ ] Função existe e é async
- [ ] Valida `currentLockId` não vazio
- [ ] Constrói URL corretamente
- [ ] Usa método DELETE
- [ ] Envia Bearer token nos headers

#### ✅ Linha 590 - Construção de URL
```javascript
const url = `${API_URL}/device/${currentLockId}/temp-password/${passwordId}`;
```
- [ ] URL contém deviceId (currentLockId)
- [ ] URL contém passwordId
- [ ] API_URL está definido (= 'http://localhost:3000/api')

#### ✅ Linha 595-605 - Tratamento de Resposta
```javascript
let data;
try {
    const responseText = await res.text();
    if (responseText) {
        data = JSON.parse(responseText);
    } else {
        data = { success: res.ok };
    }
} catch (parseErr) {
    data = { success: res.ok, message: 'Resposta sem JSON válido' };
}
```
- [ ] Trata resposta como texto primeiro
- [ ] Parse JSON apenas se houver conteúdo
- [ ] Fallback para `res.ok` se vazio
- [ ] Tratamento de erro no parse

#### ✅ Linha 607-614 - Verificação de Sucesso
```javascript
if (data.success || res.ok) {
    showAlert('✅ Senha deletada com sucesso!', 'success');
    setTimeout(() => loadPasswords(), 500);
} else {
    showAlert(`❌ ${data.error || data.msg || 'Erro ao deletar'}`, 'error');
}
```
- [ ] Verifica `data.success` ou `res.ok`
- [ ] Exibe alerta de sucesso
- [ ] Recarrega lista após 500ms
- [ ] Exibe mensagem de erro se falhar

---

## 📊 Verificação de Logging

### Frontend Console Esperado
```javascript
🗑️ Deletando senha: [ID]
🔑 Usando deviceId: [ID]
💾 localStorage.currentLockId: [ID]
📍 URL da requisição: http://localhost:3000/api/device/.../temp-password/...
📋 Headers: {Content-Type: ..., Authorization: ...}
📊 Status HTTP: 200
📝 Response OK: true
✅ Resposta do servidor: {success: true, ...}
```

- [ ] Todos estes logs aparecem no console

### Backend Terminal Esperado
```
🗑️ DELETE - Deletando senha: deviceId=..., passwordId=...
👤 User ID: ...
🌐 Region Host: ...
⏳ Enviando requisição DELETE para Tuya...
✅ DELETE - Sucesso! Status: 200
✅ Resposta da API Tuya: {...}
```

- [ ] Todos estes logs aparecem no terminal

### Network Tab Esperado
```
Request Method: DELETE
Request URL: http://localhost:3000/api/device/.../temp-password/...
Status Code: 200 OK
Response Body: {"success": true, "message": "...", "result": {...}}
```

- [ ] URL está correta
- [ ] Método é DELETE
- [ ] Status é 200 ou 204
- [ ] Response contém `"success": true`

---

## 🛡️ Testes de Erro

### Cenário 1: currentLockId não definido
**Como reproduzir:**
1. Abrir `http://localhost:3000/passwords.html` (sem ?lockId=)
2. Clicar em deletar

**Resultado esperado:**
```
❌ Erro: Fechadura não selecionada
(redirecionado para dashboard em 2s)
```
- [ ] Alerta de erro exibido
- [ ] Redirecionamento funciona

### Cenário 2: Sem credenciais Tuya
**Como reproduzir:**
1. Remover credenciais Tuya (apagar do banco)
2. Tentar deletar senha

**Resultado esperado:**
```
❌ Configure suas credenciais Tuya antes de continuar
```
- [ ] Alerta de erro exibido
- [ ] Não faz requisição desnecessária

### Cenário 3: Passwordi inválido
**Como reproduzir:**
1. Abrir DevTools → Network
2. Editar requisição DELETE e trocar passwordId por "INVALID"
3. Clicar em deletar

**Resultado esperado:**
```
Status: 400 ou 500
{"success": false, "error": "..."}
```
- [ ] Status code apropriado
- [ ] Mensagem de erro exibida
- [ ] Interface não quebra

---

## 🔄 Testes de Recarregamento

### Teste 1: Recarregar após selecionar lock
1. Abrir `http://localhost:3000/passwords.html?lockId=123`
2. Pressionar F5 (recarregar)
3. Verificar: `console.log(localStorage.getItem('currentLockId'))`

**Esperado:** `'123'`
- [ ] localStorage mantém o valor

### Teste 2: Recarregar no meio da operação
1. Abrir página de passwords
2. Pressionar F5 enquanto fazendo requisição
3. Verificar console

**Esperado:** Sem erros críticos
- [ ] Página carrega corretamente
- [ ] currentLockId é restaurado

### Teste 3: Navegar entre abas
1. Abrir passwords.html
2. Ir para outra aba (locks, dashboard)
3. Voltar para passwords
4. Tentar deletar

**Esperado:** Funciona normalmente
- [ ] localStorage preservado
- [ ] Deletar ainda funciona

---

## 📈 Testes de Performance

### Teste 1: Requisição DELETE rápida
- [ ] Tempo de resposta < 5 segundos
- [ ] Alerta aparece imediatamente
- [ ] Lista recarrega em < 1 segundo

### Teste 2: Múltiplos deletes seguidos
1. Deletar 3 senhas rapidamente
2. Verificar se todas são deletadas

**Esperado:**
- [ ] Todas deletadas com sucesso
- [ ] Sem race conditions
- [ ] Logs claros para cada uma

### Teste 3: Deletar com conexão lenta
1. Simular conexão lenta (DevTools → Throttle)
2. Deletar senha
3. Aguardar resposta

**Esperado:**
- [ ] Timeout após 30 segundos
- [ ] Mensagem de erro apropriada
- [ ] Sem travar interface

---

## 📋 Checklist Final

### Antes de Considerar "Pronto"

- [ ] ✅ Backend: Endpoint DELETE está correto
- [ ] ✅ Frontend: currentLockId é salvo no localStorage
- [ ] ✅ Frontend: deletePassword() funciona corretamente
- [ ] ✅ Tests: Teste básico de deleção passa
- [ ] ✅ Tests: Teste de erro sem config Tuya passa
- [ ] ✅ Tests: Teste de recarregamento funciona
- [ ] ✅ Logging: Console frontend mostra logs corretos
- [ ] ✅ Logging: Terminal backend mostra logs corretos
- [ ] ✅ Network: Status code é 200 ou 204
- [ ] ✅ Response: JSON retornado é válido
- [ ] ✅ Documentation: FIXES_DELETE_PASSWORD.md está atualizado
- [ ] ✅ Documentation: GUIA_TESTE_DELETE.md está disponível
- [ ] ✅ Documentation: RESUMO_VISUAL_MUDANCAS.md está disponível

### Se Todos os Itens Estiverem Marcados
✅ **O botão deletar está 100% funcional!**

---

## 🚀 Deployment

Quando estiver pronto para colocar em produção:

- [ ] Remover/ocultar logs de debug do console
- [ ] Aumentar timeout para > 30 segundos
- [ ] Testar com dados reais de produção
- [ ] Configurar monitoramento de erros
- [ ] Testar em múltiplos navegadores

---

**Versão do Checklist:** 1.0  
**Última atualização:** Outubro 21, 2025  
**Status:** ✅ ATIVO E PRONTO PARA USO
