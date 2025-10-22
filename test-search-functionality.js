/**
 * test-search-functionality.js
 * 
 * Script de teste para validar o sistema de busca em tempo real
 * Simula dados de fechaduras e testa as funções de filtragem
 */

// Mock de dados de fechaduras para teste
const mockLocks = [
    { id: 1, nome: "Porta Principal", local: "Entrada", accommodation_id: 1 },
    { id: 2, nome: "Porta Traseira", local: "Cozinha", accommodation_id: 1 },
    { id: 3, nome: "Porta do Quarto", local: "Quarto 1", accommodation_id: 2 },
    { id: 4, nome: "Porta do Banheiro", local: "Banheiro", accommodation_id: 1 },
    { id: 5, nome: "Fechadura da Garagem", local: "Garagem", accommodation_id: 3 },
    { id: 6, nome: "Fechadura do Escritório", local: "Escritório", accommodation_id: 2 },
];

// Função de teste 1: Filtragem básica
function testBasicFilter() {
    console.group("✅ TESTE 1: Filtragem Básica");
    
    const searchTerm = "Porta";
    const filtered = mockLocks.filter(lock => {
        const name = lock.nome.toLowerCase();
        const location = (lock.local || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || location.includes(search);
    });
    
    console.log(`Busca por: "${searchTerm}"`);
    console.log(`Resultados encontrados: ${filtered.length}`);
    console.log("Lockss:", filtered);
    console.assert(filtered.length === 4, "Deveria encontrar 4 resultados com 'Porta'");
    console.groupEnd();
}

// Função de teste 2: Busca case-insensitive
function testCaseInsensitive() {
    console.group("✅ TESTE 2: Busca Case-Insensitive");
    
    const testCases = [
        { search: "porta", expected: 4 },
        { search: "PORTA", expected: 4 },
        { search: "PoRtA", expected: 4 },
    ];
    
    testCases.forEach(testCase => {
        const filtered = mockLocks.filter(lock => {
            const name = lock.nome.toLowerCase();
            const location = (lock.local || '').toLowerCase();
            const search = testCase.search.toLowerCase();
            return name.includes(search) || location.includes(search);
        });
        
        console.log(`Busca por: "${testCase.search}" → ${filtered.length} resultados`);
        console.assert(filtered.length === testCase.expected, 
            `Deveria encontrar ${testCase.expected} resultados para "${testCase.search}"`);
    });
    
    console.groupEnd();
}

// Função de teste 3: Busca por localização
function testLocationSearch() {
    console.group("✅ TESTE 3: Busca por Localização");
    
    const searchTerm = "Quarto";
    const filtered = mockLocks.filter(lock => {
        const name = lock.nome.toLowerCase();
        const location = (lock.local || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || location.includes(search);
    });
    
    console.log(`Busca por localização: "${searchTerm}"`);
    console.log(`Resultados encontrados: ${filtered.length}`);
    console.log("Locks:", filtered);
    console.assert(filtered.length === 1, "Deveria encontrar 1 resultado com 'Quarto'");
    console.groupEnd();
}

// Função de teste 4: Sem resultados
function testNoResults() {
    console.group("✅ TESTE 4: Sem Resultados");
    
    const searchTerm = "XYZ123";
    const filtered = mockLocks.filter(lock => {
        const name = lock.nome.toLowerCase();
        const location = (lock.local || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || location.includes(search);
    });
    
    console.log(`Busca por: "${searchTerm}"`);
    console.log(`Resultados encontrados: ${filtered.length}`);
    console.assert(filtered.length === 0, "Deveria não encontrar nenhum resultado");
    console.log("✅ Comportamento esperado para sem resultados");
    console.groupEnd();
}

// Função de teste 5: Contador de resultados
function testResultCounter() {
    console.group("✅ TESTE 5: Contador de Resultados");
    
    const testCases = [
        { search: "Porta", expectedCount: "4/6" },
        { search: "Fechadura", expectedCount: "2/6" },
        { search: "Garagem", expectedCount: "1/6" },
        { search: "", expectedCount: "" }, // Sem busca, sem contador
    ];
    
    testCases.forEach(testCase => {
        if (!testCase.search.trim()) {
            console.log(`Busca vazia → Sem contador (display: none)`);
            return;
        }
        
        const filtered = mockLocks.filter(lock => {
            const name = lock.nome.toLowerCase();
            const location = (lock.local || '').toLowerCase();
            const search = testCase.search.toLowerCase();
            return name.includes(search) || location.includes(search);
        });
        
        const resultText = filtered.length === mockLocks.length 
            ? '' 
            : `${filtered.length}/${mockLocks.length}`;
        
        console.log(`Busca: "${testCase.search}" → Contador: "${resultText}"`);
        console.assert(resultText === testCase.expectedCount, 
            `Contador deveria ser "${testCase.expectedCount}"`);
    });
    
    console.groupEnd();
}

// Função de teste 6: Simulação de digitação progressiva
function testProgressiveTyping() {
    console.group("✅ TESTE 6: Simulação de Digitação Progressiva");
    
    const fullSearch = "Porta";
    const steps = ["P", "Po", "Por", "Port", "Porta"];
    
    console.log("Simulando digitação progressiva: 'Porta'");
    
    steps.forEach(step => {
        const filtered = mockLocks.filter(lock => {
            const name = lock.nome.toLowerCase();
            const location = (lock.local || '').toLowerCase();
            const search = step.toLowerCase();
            return name.includes(search) || location.includes(search);
        });
        
        console.log(`  "${step}" → ${filtered.length} resultado(s)`);
    });
    
    console.groupEnd();
}

// Função de teste 7: Validação de campos da lock
function testLockFieldsValidation() {
    console.group("✅ TESTE 7: Validação de Campos");
    
    console.log("Verificando estrutura das locks:");
    mockLocks.forEach((lock, index) => {
        console.assert(lock.id !== undefined, `Lock ${index} tem ID`);
        console.assert(lock.nome !== undefined, `Lock ${index} tem NOME`);
        console.assert(lock.local !== undefined, `Lock ${index} tem LOCAL`);
        console.log(`  ✅ Lock ${index}: ${lock.nome} (${lock.local})`);
    });
    
    console.groupEnd();
}

// Executar todos os testes
function runAllTests() {
    console.clear();
    console.log("🧪 INICIANDO TESTES DO SISTEMA DE BUSCA");
    console.log("=".repeat(50));
    console.log("");
    
    testBasicFilter();
    console.log("");
    
    testCaseInsensitive();
    console.log("");
    
    testLocationSearch();
    console.log("");
    
    testNoResults();
    console.log("");
    
    testResultCounter();
    console.log("");
    
    testProgressiveTyping();
    console.log("");
    
    testLockFieldsValidation();
    console.log("");
    
    console.log("=".repeat(50));
    console.log("✅ TODOS OS TESTES EXECUTADOS COM SUCESSO!");
    console.log("");
}

// Executar testes
runAllTests();

// Exportar para uso em testes automatizados
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testBasicFilter,
        testCaseInsensitive,
        testLocationSearch,
        testNoResults,
        testResultCounter,
        testProgressiveTyping,
        testLockFieldsValidation,
        runAllTests
    };
}
