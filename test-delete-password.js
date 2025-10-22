/**
 * SCRIPT DE TESTE - Botão Deletar Senhas
 * 
 * Como usar:
 * 1. Abrir a página passwords.html
 * 2. Abrir DevTools (F12)
 * 3. Ir para a aba "Console"
 * 4. Copiar e colar este script inteiro
 * 5. Pressionar Enter
 * 
 * Este script fará os testes básicos de verificação
 */

console.log('================================');
console.log('🧪 TESTE DE BOTÃO DELETAR SENHAS');
console.log('================================\n');

// Teste 1: Verificar currentLockId
console.log('📌 TESTE 1: Verificar currentLockId');
console.log('-----------------------------------');
console.log(`currentLockId (variável): ${typeof currentLockId !== 'undefined' ? currentLockId : 'UNDEFINED'}`);
console.log(`localStorage.currentLockId: ${localStorage.getItem('currentLockId') || 'NÃO SALVO'}`);
console.log(`localStorage.token: ${localStorage.getItem('token') ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
console.log('');

// Teste 2: Verificar URL
console.log('📌 TESTE 2: Verificar construção de URL');
console.log('--------------------------------------');
const testPasswordId = '123456789';
const testUrl = `http://localhost:3000/api/device/${currentLockId || 'UNDEFINED'}/temp-password/${testPasswordId}`;
console.log(`URL construída: ${testUrl}`);
console.log('');

// Teste 3: Verificar headers
console.log('📌 TESTE 3: Verificar headers');
console.log('----------------------------');
const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
};
console.log('Headers que serão enviados:');
console.log(JSON.stringify(headers, null, 2));
console.log('');

// Teste 4: Simular requisição DELETE (sem enviar)
console.log('📌 TESTE 4: Simular requisição DELETE');
console.log('------------------------------------');
console.log('⚠️  Requisição NÃO será enviada, apenas simulada');
console.log(`Método: DELETE`);
console.log(`URL: ${testUrl}`);
console.log(`Headers: Content-Type, Authorization`);
console.log('');

// Teste 5: Verificar se a função deletePassword existe
console.log('📌 TESTE 5: Verificar função deletePassword');
console.log('-----------------------------------------');
console.log(`Função deletePassword existe: ${typeof deletePassword === 'function' ? '✅ SIM' : '❌ NÃO'}`);
console.log(`Função loadPasswords existe: ${typeof loadPasswords === 'function' ? '✅ SIM' : '❌ NÃO'}`);
console.log('');

// Teste 6: Recomendações
console.log('📌 TESTE 6: Recomendações');
console.log('------------------------');
if (!currentLockId) {
    console.error('❌ currentLockId não está definido!');
    console.log('✅ Solução: Abrir passwords.html com URL ?lockId=SEU_ID_AQUI');
} else {
    console.log(`✅ currentLockId está correto: ${currentLockId}`);
}

if (!localStorage.getItem('token')) {
    console.error('❌ Token não existe no localStorage!');
    console.log('✅ Solução: Fazer login novamente');
} else {
    console.log('✅ Token existe no localStorage');
}

if (!localStorage.getItem('currentLockId')) {
    console.warn('⚠️  currentLockId não foi salvo no localStorage');
    console.log('✅ Solução: Carregar página novamente com URL ?lockId=SEU_ID_AQUI');
} else {
    console.log('✅ currentLockId foi salvo no localStorage');
}

console.log('');
console.log('================================');
console.log('🧪 FIM DOS TESTES');
console.log('================================');
console.log('');

// Teste prático (descomente para fazer teste real)
/*
console.log('🔥 TESTE PRÁTICO - Enviando requisição DELETE');
console.log('-------------------------------------------');
const samplePasswordId = 'PASTE_HERE_A_REAL_PASSWORD_ID';
fetch(`http://localhost:3000/api/device/${currentLockId}/temp-password/${samplePasswordId}`, {
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
})
.then(res => {
    console.log(`📊 Status HTTP: ${res.status} ${res.statusText}`);
    return res.json();
})
.then(data => {
    console.log('✅ Resposta:', data);
})
.catch(err => {
    console.error('❌ Erro:', err);
});
*/

console.log('💡 Para fazer teste prático com DELETE, descomente a seção no final do script');
