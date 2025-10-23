# CORREÇÃO - Status Offline do Tuya

## Problema
Após as modificações para ler credenciais do `.env`, o status da conta Tuya ficava offline no dashboard.

## Causa
A função `checkTuyaStatus()` no `dashboard.html` estava verificando a mensagem de erro antiga:
```javascript
if (response.status === 400 && data.error && data.error.includes('Configure')) {
```

Mas a nova mensagem retornada pelo servidor é:
```
'Credenciais Tuya não estão configuradas no arquivo .env'
```

## Solução Implementada

### 1. `public/dashboard.html`
✅ Atualizada função `checkTuyaStatus()`:
```javascript
if (response.status === 400 && data.error && (data.error.includes('Configure') || data.error.includes('não estão configuradas'))) {
```

Agora detecta ambas as mensagens (antiga e nova).

### 2. `public/settings.html`
✅ **Desabilitou campos de entrada:** Os campos `tuya-client-id`, `tuya-client-secret` e `tuya-region` agora estão `disabled` para indicar que vêm do `.env`.

✅ **Atualizada `loadTuyaConfig()`:**
- Mostra "(não configurado)" se TUYA_CLIENT_ID não existe
- Mostra "(configurado via .env)" para TUYA_CLIENT_SECRET
- Disabilita todos os campos
- Exibe alert informativo

✅ **Atualizada `handleTuyaSubmit()`:**
- Mostra aviso de que credenciais vêm do `.env`
- Não tenta mais salvar no banco

✅ **Atualizada `handleTuyaTest()`:**
- Remove tentativa de salvar antes de testar
- Apenas testa a conexão com credenciais do `.env`
- Mensagem clara: "usando credenciais do .env"

✅ **Atualizada `handleClearTuya()`:**
- Mostra aviso de que não pode deletar via interface
- Instrui para editar o `.env`

## Resultado
✅ Dashboard agora mostra corretamente:
- 🟢 **Online** - quando credenciais estão no `.env` e conexão está ok
- ⚙️ **Não configurado** - quando credenciais não estão no `.env`
- 🔴 **Offline** - quando há erro na conexão com Tuya API

✅ Settings agora mostra:
- Aviso claro de que credenciais vêm do `.env`
- Campos desabilitados (read-only)
- Instruções para editar `.env`

## Verificação
Teste executando:
```bash
npm run dev
```

E verificando:
1. Dashboard mostra status correto (🟢 Online ou outro)
2. Settings mostra campos desabilitados
3. Botão "Testar Conexão" funciona corretamente

