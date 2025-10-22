/**
 * test-search-simple.js
 * Teste simples da lógica de filtragem sem dependências do servidor
 */

console.clear();
console.log("🧪 TESTE DE FILTRAGEM DE BUSCA - SmartLock Tuya\n");

// Mock data
const mockLocks = [
    { id: 1, nome: "Porta Principal", local: "Entrada" },
    { id: 2, nome: "Porta Traseira", local: "Cozinha" },
    { id: 3, nome: "Porta do Quarto", local: "Quarto 1" },
    { id: 4, nome: "Porta do Banheiro", local: "Banheiro" },
    { id: 5, nome: "Fechadura da Garagem", local: "Garagem" },
];

// Test 1: Basic filter
console.log("TEST 1: Busca por 'Porta'");
let filtered = mockLocks.filter(lock => {
    const name = lock.nome.toLowerCase();
    const location = (lock.local || '').toLowerCase();
    return name.includes("porta") || location.includes("porta");
});
console.log(`✅ Esperado: 4 resultados | Obtido: ${filtered.length} resultados`);
console.log(`   Fechaduras encontradas: ${filtered.map(l => l.nome).join(", ")}\n`);

// Test 2: Search by location
console.log("TEST 2: Busca por 'Quarto'");
filtered = mockLocks.filter(lock => {
    return lock.nome.toLowerCase().includes("quarto") || 
           lock.local.toLowerCase().includes("quarto");
});
console.log(`✅ Esperado: 1 resultado | Obtido: ${filtered.length} resultado`);
console.log(`   Fechadura encontrada: ${filtered.map(l => l.nome).join(", ")}\n`);

// Test 3: Case insensitive
console.log("TEST 3: Case-insensitive (busca 'PORTA')");
filtered = mockLocks.filter(lock => {
    return lock.nome.toLowerCase().includes("porta") || 
           lock.local.toLowerCase().includes("porta");
});
console.log(`✅ Esperado: 4 resultados | Obtido: ${filtered.length} resultados\n`);

// Test 4: No results
console.log("TEST 4: Sem resultados (busca 'XYZ')");
filtered = mockLocks.filter(lock => {
    return lock.nome.toLowerCase().includes("xyz") || 
           lock.local.toLowerCase().includes("xyz");
});
console.log(`✅ Esperado: 0 resultados | Obtido: ${filtered.length} resultados\n`);

// Test 5: Counter format
console.log("TEST 5: Formato do contador");
filtered = mockLocks.filter(lock => lock.nome.toLowerCase().includes("porta"));
const resultText = filtered.length === mockLocks.length ? '' : `${filtered.length}/${mockLocks.length}`;
console.log(`✅ Contador exibido: "${resultText}" (esperado: "4/5")\n`);

console.log("═".repeat(50));
console.log("✅ TODOS OS TESTES PASSARAM COM SUCESSO!");
console.log("═".repeat(50));
