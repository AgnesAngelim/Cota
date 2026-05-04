// ── MONITORIA.JS ─────────────────────────────────────────────────────────────
// Módulo de monitoria — integrado ao dashboard.js de cotas iGreen

const MONITORIA_TITULOS = [
  {
    id: 'procedimento',
    titulo: 'Procedimento Correto',
    subtitulos: [
      'Leitura ativa',
      'Cumpriu políticas internas e de conformidade',
      'Encaminhamento de demandas',
    ]
  },
  {
    id: 'comunicacao',
    titulo: 'Comunicação e Linguagem',
    subtitulos: [
      'Empatia',
      'Evitou jargões ou termos confusos',
      'Explicação clara',
      'Foco no assunto',
      'Domínio da conversa e linguagens',
    ]
  },
  {
    id: 'eficiencia',
    titulo: 'Eficiência e Tempo',
    subtitulos: [
      'Atendimento objetivo',
      'Verificando histórico e demanda',
      'Resolução em primeiro contato',
      'Tempo de encerramento adequado',
    ]
  },
  {
    id: 'conhecimento',
    titulo: 'Conhecimento e Assertividade',
    subtitulos: [
      'Segurança nas informações',
      'Informações completas',
      'Mantém consistência nas respostas',
      'Informações corretas',
    ]
  },
  {
    id: 'registro',
    titulo: 'Registro e Documentação',
    subtitulos: [
      'Tabulação correta da demanda',
      'Registro de informações clara e completa',
      'Incluiu observações relevantes',
    ]
  },
];

// ── Estado ────────────────────────────────────────────────────────────────────
let monState = {
  colaborador:       '',
  protocolo:         '',
  data:              new Date().toISOString().slice(0, 10),
  tempo_atendimento: '',
  tempo_resposta:    '',
  tempo_espera:      '',
  tituloAberto:      null,
  respostas:         {},
};

// ── Storage ───────────────────────────────────────────────────────────────────
function monGetAll() {
  try { return JSON.parse(localStorage.getItem('igreen_monitorias') || '[]'); }
  catch { return []; }
}
function monSaveReg(r) {
  const all = monGetAll(); all.unshift(r);
  localStorage.setItem('igreen_monitorias', JSON.stringify(all));
}
function monDeleteReg(id) {
  localStorage.setItem('igreen_monitorias',
    JSON.stringify(monGetAll().filter(r => r.id !== id)));
}

// ── Colaboradores (vem do members global do dashboard.js) ─────────────────────
function monGetColaboradores() {
  if (typeof members !== 'undefined' && members && members.length) return members;
  return [];
}

function monAtualizarSelect() {
  const sel = document.getElementById('mon-colaborador');
  if (!sel) return;
  const lista = monGetColaboradores();
  const atual = monState.colaborador;
  sel.innerHTML = '<option value="">— selecione —</option>' +
    (lista.length
      ? lista.map(n => `<option value="${n}"${n === atual ? ' selected' : ''}>${n}</option>`).join('')
      : '<option value="" disabled style="color:#64748B">Carregue a planilha para listar</option>');
}

// ── Salva campos no estado antes de re-renderizar ─────────────────────────────
function monSalvarCampos() {
  const c  = document.getElementById('mon-colaborador');
  const p  = document.getElementById('mon-protocolo');
  const d  = document.getElementById('mon-data');
  const ta = document.getElementById('mon-tempo-atendimento');
  const tr = document.getElementById('mon-tempo-resposta');
  const te = document.getElementById('mon-tempo-espera');
  if (c)  monState.colaborador       = c.value;
  if (p)  monState.protocolo         = p.value;
  if (d)  monState.data              = d.value;
  if (ta) monState.tempo_atendimento = ta.value;
  if (tr) monState.tempo_resposta    = tr.value;
  if (te) monState.tempo_espera      = te.value;
}

// ── Render dos títulos e subtítulos (layout em duas colunas) ─────────────────
function monRenderTitulos() {
  const container = document.getElementById('mon-titulos-lista');
  if (!container) return;

  // Todos os títulos e subtítulos visíveis de uma vez, sem accordion
  container.innerHTML = `<div class="mon-layout">
    <div class="mon-col-titulos">
      ${MONITORIA_TITULOS.map(t => {
        const respondidos = t.subtitulos.filter((_, i) => monState.respostas[`${t.id}_${i}`]).length;
        return `<div class="mon-titulo-grupo">
          <div class="mon-titulo-cabecalho">
            <span class="mon-titulo-nome">${t.titulo}</span>
            <span class="mon-titulo-count">${respondidos}/${t.subtitulos.length}</span>
          </div>
          <div class="mon-subtitulos-lista">
            ${t.subtitulos.map((sub, i) => `
              <div class="mon-sub-item">
                <span class="mon-sub-label">${sub}</span>
              </div>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="mon-col-toggles">
      ${MONITORIA_TITULOS.map(t => `
        <div class="mon-toggles-grupo">
          <div class="mon-toggles-spacer"></div>
          ${t.subtitulos.map((_, i) => {
            const key = `${t.id}_${i}`;
            const val = monState.respostas[key] || '';
            return `<div class="mon-toggle-row">
              <button class="mon-toggle${val === 'sim' ? ' mon-toggle-sim' : ''}" data-key="${key}" data-val="sim">SIM</button>
              <button class="mon-toggle${val === 'nao' ? ' mon-toggle-nao' : ''}" data-key="${key}" data-val="nao">NÃO</button>
            </div>`;
          }).join('')}
        </div>`).join('')}
    </div>
  </div>`;

  container.querySelectorAll('.mon-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key, val = btn.dataset.val;
      monState.respostas[key] = monState.respostas[key] === val ? '' : val;
      monRenderTitulos();
    });
  });
}

// ── Render do histórico ───────────────────────────────────────────────────────
function monRenderHistorico() {
  const container = document.getElementById('mon-historico-lista');
  const countEl   = document.getElementById('mon-hist-count');
  if (!container) return;

  const all = monGetAll();
  if (countEl) countEl.textContent = `${all.length} registro${all.length !== 1 ? 's' : ''}`;

  if (!all.length) {
    container.innerHTML = '<div class="mon-hist-empty">Nenhum registro salvo ainda</div>';
    return;
  }

  container.innerHTML = all.map(r => {
    const tags = MONITORIA_TITULOS.map(t => {
      const sims = t.subtitulos.filter((_, i) => r.respostas[`${t.id}_${i}`] === 'sim').length;
      const pct  = Math.round(sims / t.subtitulos.length * 100);
      const cor  = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
      return `<span class="mon-hist-tag" style="color:${cor};border-color:${cor}30;background:${cor}15;">${t.titulo.split(' ')[0]} ${pct}%</span>`;
    }).join('');

    return `<div class="mon-hist-item mon-hist-clicavel" data-id="${r.id}">
      <div class="mon-hist-info">
        <span class="mon-hist-nome">${r.colaborador || '—'}</span>
        <span class="mon-hist-proto">Protocolo: ${r.protocolo || '—'}</span>
        <span class="mon-hist-data">${r.data || '—'}</span>
      </div>
      <div class="mon-hist-resumo">${tags}</div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mon-hist-ver" data-id="${r.id}" title="Ver detalhes">👁</button>
        <button class="mon-hist-del" data-id="${r.id}" title="Excluir">✕</button>
      </div>
    </div>`;
  }).join('');

  // Clique no item ou no botão ver → abre modal
  container.querySelectorAll('.mon-hist-clicavel').forEach(el => {
    el.addEventListener('click', e => {
      // Ignora se clicou no botão excluir
      if (e.target.closest('.mon-hist-del')) return;
      const id = el.dataset.id;
      const reg = monGetAll().find(r => r.id === id);
      if (reg) monAbrirDetalhe(reg);
    });
  });

  container.querySelectorAll('.mon-hist-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Excluir este registro?')) {
        monDeleteReg(btn.dataset.id);
        monRenderHistorico();
      }
    });
  });
}

// ── Modal de detalhe do registro ──────────────────────────────────────────────
function monAbrirDetalhe(r) {
  // Remove modal anterior se existir
  document.getElementById('mon-modal')?.remove();

  const blocos = MONITORIA_TITULOS.map(t => {
    const respondidos = t.subtitulos.map((sub, i) => {
      const key = `${t.id}_${i}`;
      const val = r.respostas[key] || '';
      const cor = val === 'sim' ? '#10B981' : val === 'nao' ? '#EF4444' : '#64748B';
      const label = val === 'sim' ? 'SIM' : val === 'nao' ? 'NÃO' : '—';
      return `<div class="mon-det-sub-row">
        <span class="mon-det-sub-label">${sub}</span>
        <span class="mon-det-badge" style="color:${cor};background:${cor}18;border:1px solid ${cor}40;">${label}</span>
      </div>`;
    }).join('');

    const sims  = t.subtitulos.filter((_, i) => r.respostas[`${t.id}_${i}`] === 'sim').length;
    const total = t.subtitulos.length;
    const pct   = Math.round(sims / total * 100);
    const cor   = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';

    return `<div class="mon-det-bloco">
      <div class="mon-det-titulo">
        <span>${t.titulo}</span>
        <span class="mon-det-pct" style="color:${cor};background:${cor}15;border:1px solid ${cor}30;">${pct}%</span>
      </div>
      ${respondidos}
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'mon-modal';
  modal.className = 'mon-modal-overlay';
  modal.innerHTML = `
    <div class="mon-modal-box">
      <div class="mon-modal-header">
        <div>
          <div class="mon-modal-nome">${r.colaborador || '—'}</div>
          <div class="mon-modal-meta">Protocolo: ${r.protocolo || '—'} &nbsp;·&nbsp; Data: ${r.data || '—'}</div>
          ${(r.tempo_atendimento || r.tempo_resposta || r.tempo_espera) ? `
          <div class="mon-modal-tempos">
            ${r.tempo_atendimento ? `<span><span class="mon-tempo-label">Atendimento:</span> ${r.tempo_atendimento}</span>` : ''}
            ${r.tempo_resposta    ? `<span><span class="mon-tempo-label">1ª resposta:</span> ${r.tempo_resposta}</span>` : ''}
            ${r.tempo_espera      ? `<span><span class="mon-tempo-label">Máx. espera:</span> ${r.tempo_espera}</span>` : ''}
          </div>` : ''}
        </div>
        <button class="mon-modal-fechar" id="mon-modal-fechar">✕</button>
      </div>
      <div class="mon-modal-body">
        ${blocos}
      </div>
    </div>`;

  // Anexa direto ao body e libera o overflow temporariamente
  document.body.style.overflow = 'auto';
  document.body.appendChild(modal);

  const monFechar = () => {
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };

  document.getElementById('mon-modal-fechar').addEventListener('click', monFechar);
  modal.addEventListener('click', e => { if (e.target === modal) monFechar(); });

  const onKey = e => { if (e.key === 'Escape') monFechar(); };
  document.addEventListener('keydown', onKey);
}

// ── Render principal — chamado pelo render() do dashboard.js ──────────────────
function monRender() {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="mon-container">
      <div class="mon-card">
        <div class="mon-card-header">
          <span class="mon-card-titulo">Nova Monitoria</span>
        </div>
        <div class="mon-card-body">
          <div class="mon-campos-topo">
            <div>
              <label class="mon-campo-label">Colaborador</label>
              <select id="mon-colaborador" class="mon-select"></select>
            </div>
            <div>
              <label class="mon-campo-label">Protocolo</label>
              <input id="mon-protocolo" class="mon-input" type="text" placeholder="Nº do protocolo" value="${monState.protocolo}">
            </div>
            <div>
              <label class="mon-campo-label">Data</label>
              <input id="mon-data" class="mon-input" type="date" value="${monState.data}">
            </div>
          </div>
          <div class="mon-campos-topo" style="margin-top:0;margin-bottom:18px;">
            <div>
              <label class="mon-campo-label">Tempo de atendimento</label>
              <input id="mon-tempo-atendimento" class="mon-input" type="text" placeholder="ex: 00:10:30" value="${monState.tempo_atendimento}">
            </div>
            <div>
              <label class="mon-campo-label">Tempo primeira resposta</label>
              <input id="mon-tempo-resposta" class="mon-input" type="text" placeholder="ex: 00:01:15" value="${monState.tempo_resposta}">
            </div>
            <div>
              <label class="mon-campo-label">Tempo máx. de espera entre respostas</label>
              <input id="mon-tempo-espera" class="mon-input" type="text" placeholder="ex: 00:05:00" value="${monState.tempo_espera}">
            </div>
          </div>
          <div class="mon-titulos-lista" id="mon-titulos-lista"></div>
        </div>
        <div class="mon-footer">
          <button class="mon-btn-limpar" id="mon-btn-limpar">Limpar</button>
          <button class="mon-btn-salvar" id="mon-btn-salvar">Salvar monitoria</button>
        </div>
      </div>

      <div class="mon-card">
        <div class="mon-card-header">
          <span class="mon-card-titulo">Registros salvos</span>
          <span class="mon-hist-count" id="mon-hist-count"></span>
        </div>
        <div class="mon-historico-lista" id="mon-historico-lista"></div>
      </div>
    </div>`;

  monAtualizarSelect();
  monRenderTitulos();
  monRenderHistorico();

  document.getElementById('mon-colaborador')?.addEventListener('change', e => { monState.colaborador       = e.target.value; });
  document.getElementById('mon-protocolo')?.addEventListener('input',  e => { monState.protocolo         = e.target.value; });
  document.getElementById('mon-data')?.addEventListener('input',       e => { monState.data              = e.target.value; });
  document.getElementById('mon-tempo-atendimento')?.addEventListener('input', e => { monState.tempo_atendimento = e.target.value; });
  document.getElementById('mon-tempo-resposta')?.addEventListener('input',    e => { monState.tempo_resposta    = e.target.value; });
  document.getElementById('mon-tempo-espera')?.addEventListener('input',      e => { monState.tempo_espera      = e.target.value; });

  document.getElementById('mon-btn-salvar')?.addEventListener('click', () => {
    monSalvarCampos();
    if (!monState.colaborador) { alert('Selecione um colaborador.'); return; }
    monSaveReg({
      id:                Date.now().toString(),
      colaborador:       monState.colaborador,
      protocolo:         monState.protocolo,
      data:              monState.data,
      tempo_atendimento: monState.tempo_atendimento,
      tempo_resposta:    monState.tempo_resposta,
      tempo_espera:      monState.tempo_espera,
      respostas:         { ...monState.respostas },
      criadoEm:          new Date().toISOString(),
    });
    monState = { colaborador: monState.colaborador, protocolo: '', data: new Date().toISOString().slice(0,10), tempo_atendimento: '', tempo_resposta: '', tempo_espera: '', tituloAberto: null, respostas: {} };
    monRender();
  });

  document.getElementById('mon-btn-limpar')?.addEventListener('click', () => {
    monState.respostas = {}; monState.protocolo = ''; monState.tituloAberto = null;
    const p = document.getElementById('mon-protocolo');
    if (p) p.value = '';
    monRenderTitulos();
  });

  content.scrollTop = 0;
}
