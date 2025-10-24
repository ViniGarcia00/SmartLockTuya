/**
 * Componente de Sugestões de Match
 * 
 * Exibe cards com sugestões de mapeamento automático
 * Permite aplicar sugestões individualmente ou em lote
 * 
 * Uso:
 * - Criar elemento: <div id="suggestions-container"></div>
 * - Chamar: loadSuggestions()
 */

class MatchSuggestionsUI {
  constructor(containerId = 'suggestions-container') {
    this.container = document.getElementById(containerId);
    this.suggestions = [];
    this.selectedSuggestions = new Set();
  }

  /**
   * Carregar sugestões do servidor
   */
  async loadSuggestions(threshold = 0.8, maxSuggestions = 1) {
    try {
      const params = new URLSearchParams({
        threshold: threshold.toString(),
        maxSuggestions: maxSuggestions.toString(),
      });

      const response = await fetch(
        `/api/admin/matches/suggestions?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const data = await response.json();

      if (!data.success) {
        this.showError(data.error || 'Erro ao carregar sugestões');
        return;
      }

      this.suggestions = data.suggestions || [];
      this.render();
    } catch (error) {
      this.showError(`Erro ao carregar sugestões: ${error.message}`);
    }
  }

  /**
   * Renderizar UI de sugestões
   */
  render() {
    if (!this.container) return;

    if (this.suggestions.length === 0) {
      this.container.innerHTML = `
        <div class="suggestions-empty">
          <p>✓ Todas as acomodações estão mapeadas ou não há fechaduras disponíveis</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="suggestions-section">
        <div class="suggestions-header">
          <h3>🔗 Sugestões de Mapeamento Automático</h3>
          <p class="suggestions-count">${this.suggestions.length} sugestão(ões) encontrada(s)</p>
        </div>

        <div class="suggestions-toolbar">
          <button id="apply-all-btn" class="btn btn-primary">
            ✓ Aplicar Todas as Sugestões
          </button>
          <button id="refresh-btn" class="btn btn-secondary">
            🔄 Atualizar
          </button>
        </div>

        <div class="suggestions-grid">
    `;

    for (const suggestion of this.suggestions) {
      const confidence = suggestion.score >= 0.9 ? 'high' : 'medium';
      const confidenceLabel = confidence === 'high' ? '🟢 Alta' : '🟡 Média';
      const scorePercent = Math.round(suggestion.score * 100);

      html += `
        <div class="suggestion-card" data-accommodation-id="${suggestion.accommodationId}">
          <div class="suggestion-content">
            <div class="suggestion-names">
              <div class="accommodation-name">
                <span class="label">Acomodação:</span>
                <span class="value">${escapeHtml(suggestion.accommodationName)}</span>
              </div>
              <div class="arrow">→</div>
              <div class="lock-name">
                <span class="label">Fechadura:</span>
                <span class="value">${escapeHtml(suggestion.lockAlias)}</span>
              </div>
            </div>

            <div class="suggestion-score">
              <div class="score-bar">
                <div class="score-fill" style="width: ${scorePercent}%"></div>
              </div>
              <span class="score-text">${scorePercent}% ${confidenceLabel}</span>
            </div>

            ${suggestion.explanation ? `
              <p class="suggestion-explanation">${escapeHtml(suggestion.explanation)}</p>
            ` : ''}
          </div>

          <div class="suggestion-actions">
            <button class="btn-apply" onclick="matchSuggestionsUI.applySuggestion('${suggestion.accommodationId}', '${suggestion.lockId}')">
              Aplicar
            </button>
            <button class="btn-dismiss" onclick="matchSuggestionsUI.dismissSuggestion('${suggestion.accommodationId}')">
              ✕
            </button>
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Adicionar listeners
    document.getElementById('apply-all-btn')?.addEventListener('click', () =>
      this.applyAllSuggestions()
    );
    document.getElementById('refresh-btn')?.addEventListener('click', () =>
      this.loadSuggestions()
    );
  }

  /**
   * Aplicar uma sugestão
   */
  async applySuggestion(accommodationId, lockId) {
    try {
      const response = await fetch('/api/admin/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ accommodationId, lockId }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(`❌ Erro: ${data.error}`);
        return;
      }

      alert('✅ Mapeamento aplicado com sucesso!');
      this.dismissSuggestion(accommodationId);
    } catch (error) {
      alert(`❌ Erro ao aplicar: ${error.message}`);
    }
  }

  /**
   * Aplicar todas as sugestões
   */
  async applyAllSuggestions() {
    if (this.suggestions.length === 0) return;

    const confirmed = confirm(
      `Aplicar ${this.suggestions.length} sugestão(ões) de mapeamento?`
    );
    if (!confirmed) return;

    try {
      let applied = 0;
      let failed = 0;

      for (const suggestion of this.suggestions) {
        try {
          const response = await fetch('/api/admin/mappings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              accommodationId: suggestion.accommodationId,
              lockId: suggestion.lockId,
            }),
          });

          if (response.ok) {
            applied++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }

      alert(
        `✅ ${applied} mapeamento(s) aplicado(s)${
          failed > 0 ? `, ${failed} falharam` : ''
        }`
      );

      this.suggestions = [];
      this.render();
    } catch (error) {
      alert(`❌ Erro ao aplicar sugestões: ${error.message}`);
    }
  }

  /**
   * Descartar uma sugestão (remover da lista)
   */
  dismissSuggestion(accommodationId) {
    this.suggestions = this.suggestions.filter(
      (s) => s.accommodationId !== accommodationId
    );
    this.render();
  }

  /**
   * Mostrar erro
   */
  showError(message) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="alert alert-error">
        ❌ ${escapeHtml(message)}
      </div>
    `;
  }
}

/**
 * Função helper: escapar HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Instância global
 */
const matchSuggestionsUI = new MatchSuggestionsUI();

/**
 * CSS Styles
 */
const styles = `
<style>
.suggestions-section {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 24px;
  margin: 24px 0;
}

.suggestions-header {
  margin-bottom: 20px;
}

.suggestions-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 8px 0;
}

.suggestions-count {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

.suggestions-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #1e293b;
  color: #94a3b8;
  border: 1px solid #334155;
}

.btn-secondary:hover {
  background: #334155;
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

.suggestion-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.suggestion-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.suggestion-content {
  flex: 1;
}

.suggestion-names {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.accommodation-name,
.lock-name {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.accommodation-name .label,
.lock-name .label {
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 2px;
}

.accommodation-name .value,
.lock-name .value {
  color: #f1f5f9;
  font-weight: 500;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow {
  color: #667eea;
  font-weight: bold;
  font-size: 16px;
}

.suggestion-score {
  margin-bottom: 12px;
}

.score-bar {
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.3s;
}

.score-text {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.suggestion-explanation {
  font-size: 12px;
  color: #cbd5e1;
  margin: 0;
  line-height: 1.4;
}

.suggestion-actions {
  display: flex;
  gap: 8px;
  margin-left: 16px;
}

.btn-apply,
.btn-dismiss {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-apply {
  background: #10b981;
  color: white;
}

.btn-apply:hover {
  background: #059669;
}

.btn-dismiss {
  background: #ef4444;
  color: white;
}

.btn-dismiss:hover {
  background: #dc2626;
}

.suggestions-empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}

.alert {
  padding: 16px;
  border-radius: 8px;
  font-size: 14px;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  color: #ef4444;
}

@media (max-width: 768px) {
  .suggestions-grid {
    grid-template-columns: 1fr;
  }

  .suggestion-names {
    flex-direction: column;
    gap: 8px;
  }

  .arrow {
    transform: rotate(90deg);
  }

  .suggestion-actions {
    margin-left: 0;
    margin-top: 12px;
    justify-content: flex-end;
  }

  .suggestion-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
`;

// Injetar styles na página
document.head.insertAdjacentHTML('beforeend', styles);

// Exportar para uso global
window.matchSuggestionsUI = matchSuggestionsUI;
