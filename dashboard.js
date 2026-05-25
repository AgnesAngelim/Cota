const META_COTA = 5000;
let allData = [];
let members = [];
let currentView = 'geral';
let currentPeriodo = -1; // -1 = todos os meses, 0..3 = trimestres
const charts = {};

const TRIMESTRES = [
  { nome: 'Trimestre 1', meses: [2, 3, 4]   },
  { nome: 'Trimestre 2', meses: [5, 6, 7]   },
  { nome: 'Trimestre 3', meses: [8, 9, 10]  },
  { nome: 'Trimestre 4', meses: [11, 12, 1] },
];

const TODOS_MESES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1];

const NOME_MES = {
  1:'Janeiro', 2:'Fevereiro', 3:'Março', 4:'Abril',
  5:'Maio', 6:'Junho', 7:'Julho', 8:'Agosto',
  9:'Setembro', 10:'Outubro', 11:'Novembro', 12:'Dezembro'
};

const C = {
  verde:'#10B981', ciano:'#06B6D4', ambar:'#F59E0B',
  vermelho:'#EF4444', laranja:'#F97316',
  bloco:'#1E293B', divisoria:'#334155', label:'#94A3B8',
};

// ── Pontuações fixas da tabela de cota
const PONTUACOES = {
  whatsapp:      3,
  transferencia: 1,
  tme_25:        1,
  tme_40:        0.5,
  tme_1h:        0,
  tme_alem:     -1.5,
  nota1:        -5,
  nota2:        -4,
  nota3:        -3,
  nota4:         4,
  nota5:         5,
  atend_presencial: 200,
  demanda_extra:    5,
};

// ── Navegação circular 
function navNext() {
  if (currentPeriodo === -1) currentPeriodo = 0;
  else currentPeriodo = (currentPeriodo + 1) % TRIMESTRES.length;
  render();
}
function navPrev() {
  if (currentPeriodo === 0) currentPeriodo = -1;
  else if (currentPeriodo === -1) currentPeriodo = TRIMESTRES.length - 1;
  else currentPeriodo--;
  render();
}

// ── Leitura flexível de colunas 
function col(row, ...keys) {
  const rk = Object.keys(row);
  for (const k of keys) {
    const f = rk.find(r => r.trim().toLowerCase() === k.toLowerCase());
    if (f !== undefined && row[f] !== undefined && row[f] !== '') return row[f];
  }
  return 0;
}
function colStr(row, ...keys) {
  const rk = Object.keys(row);
  for (const k of keys) {
    const f = rk.find(r => r.trim().toLowerCase() === k.toLowerCase());
    if (f !== undefined && row[f] !== undefined && row[f] !== '') return String(row[f]);
  }
  return '';
}

// ── Parse Mês (Ordem) 
function parseMesOrdem(valor) {
  if (!valor && valor !== 0) return null;
  const s = String(valor).trim();

  // AAAA-MM ou AAAA/MM
  let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return { ano: parseInt(m[1]), mes: parseInt(m[2]) };

  // MM/AAAA ou MM-AAAA
  m = s.match(/^(\d{1,2})[-\/](\d{4})$/);
  if (m) return { ano: parseInt(m[2]), mes: parseInt(m[1]) };

  // Formato americano M/D/YY (Excel)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) return { ano: parseInt(m[3]) + 2000, mes: parseInt(m[1]) };

  // Formato M/D/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { ano: parseInt(m[3]), mes: parseInt(m[1]) };

  // AAAA-MM-DD
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { ano: parseInt(m[1]), mes: parseInt(m[2]) };

  // Número serial do Excel
  const num = parseInt(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return { ano: date.getUTCFullYear(), mes: date.getUTCMonth() + 1 };
  }

  // Só número 1-12
  m = s.match(/^(\d{1,2})$/);
  if (m) return { ano: 2026, mes: parseInt(m[1]) };

  return null;
}

// ── Detecta o ano mais recente da planilha
function detectarAno(raw) {
  const anos = new Set();
  for (const r of raw) {
    const rk = Object.keys(r);
    const colOrdem = rk.find(k => k.trim().toLowerCase() === 'mês (ordem)' || k.trim().toLowerCase() === 'mes (ordem)');
    const ordemRaw = colOrdem ? String(r[colOrdem]).trim() : '';
    if (!ordemRaw) continue;
    const parsed = parseMesOrdem(ordemRaw);
    if (parsed && parsed.ano >= 2020 && parsed.ano <= 2099) anos.add(parsed.ano);
  }
  if (!anos.size) return 2026;
  return Math.max(...anos);
}

function anoAtual() {
  if (!allData.length) return 2026;
  return Math.max(...allData.map(r => r.ano || 2026));
}

// ── Parse da planilha 
function parseRows(raw) {
  const anoAlvo = detectarAno(raw);
  const rows = [];
  for (const r of raw) {
    const rk = Object.keys(r);
    const colOrdem = rk.find(k => k.trim().toLowerCase() === 'mês (ordem)' || k.trim().toLowerCase() === 'mes (ordem)');
    const ordemRaw = colOrdem ? String(r[colOrdem]).trim() : colStr(r, 'mês(ordem)', 'mes(ordem)', 'refmês (ordem)', 'refmes (ordem)');
    const parsed = parseMesOrdem(ordemRaw);
    if (!parsed || parsed.ano !== anoAlvo) continue;
    if (parsed.mes < 1 || parsed.mes > 12) continue;
    const colaborador = colStr(r, 'colaborador', 'nome');
    if (!colaborador) continue;
    rows.push({
      mes: parsed.mes, ano: parsed.ano, colaborador,
      atendimentos:  parseFloat(col(r,'atendimentos')) || 0,
      cota_pts:      parseFloat(col(r,'cota (pts)','cota pts','cota(pts)','cota')) || 0,
      csat:          parseFloat(col(r,'csat (%)','csat(%)','csat')) || 0,
      tma:           parseFloat(col(r,'tma (min)','tma(min)','tma')) || 0,
      tme:           parseFloat(col(r,'tme (min)','tme(min)','tme')) || 0,
      cota1:         parseFloat(col(r,'cota 1','cota1')) || 0,
      cota2:         parseFloat(col(r,'cota 2','cota2')) || 0,
      cota3:         parseFloat(col(r,'cota 3','cota3')) || 0,
      cota4:         parseFloat(col(r,'cota 4','cota4')) || 0,
      cota5:         parseFloat(col(r,'cota 5','cota5')) || 0,
      telecom:       parseFloat(col(r,'telecom')) || 0,
      club:          parseFloat(col(r,'club')) || 0,
      internacional: parseFloat(col(r,'internacional')) || 0,
      nota5:         parseFloat(col(r,'nota 5','nota5')) || 0,
      nota4:         parseFloat(col(r,'nota 4','nota4')) || 0,
      nota3:         parseFloat(col(r,'nota 3','nota3')) || 0,
      nota2:         parseFloat(col(r,'nota 2','nota2')) || 0,
      nota1:         parseFloat(col(r,'nota 1','nota1')) || 0,
      p_atraso:      Math.abs(parseFloat(col(r,'atraso')) || 0),
      p_procedimento:Math.abs(parseFloat(col(r,'procedimento incorreto')) || 0),
      p_celular:     Math.abs(parseFloat(col(r,'celular')) || 0),
      p_omissao:     Math.abs(parseFloat(col(r,'omissao de atendimento','omissão de atendimento')) || 0),
      p_uniforme:    Math.abs(parseFloat(col(r,'uniforme')) || 0),
      atend_presencial: parseFloat(col(r,'atendimento presencial','atendimentos presencial','atend. presencial','at. presencial')) || 0,
      demanda_extra:    parseFloat(col(r,'demanda extra (whatsapp, envios, etc)','demanda extra','demanda extra (whatsapp)','demanda_extra')) || 0,
      monitoria:        parseFloat(col(r,'monitoria')) || 0,
      whatsapp:         parseFloat(col(r,'atendimentos')) || 0,  // Whatsapp - Chat Huggy vem da coluna Atendimentos
      transferencia:    parseFloat(col(r,'transferencia','transferência')) || 0,
      tme_25:           parseFloat(col(r,'tme— até 25 min','tme - até 25 min','tme até 25 min','tme— até 25 min')) || 0,
      tme_40:           parseFloat(col(r,'tme — até 40 min','tme - até 40 min','tme até 40 min')) || 0,
      tme_1h:           parseFloat(col(r,'tme — até de 1 h','tme - até 1h','tme até 1h','tme — até 1 h')) || 0,
      tme_alem:         parseFloat(col(r,'tme — além de 1h','tme - além de 1h','tme além de 1h')) || 0,
    });
  }
  return rows;
}

// ── Sidebar dinâmica 
function buildSidebar() {
  members = [...new Set(allData.map(r => r.colaborador))].sort();
  document.getElementById('sb-colab-title').style.display = members.length ? '' : 'none';
  document.getElementById('nav-members').innerHTML = members.map(m =>
    `<div class="nav-item" data-view="${m}">${m}</div>`
  ).join('');
  bindNavEvents();
}

function bindNavEvents() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      currentView = el.dataset.view;
      render();
    });
  });
}

// ── Topbar 
function getMesesAtivos() {
  return currentPeriodo === -1 ? TODOS_MESES : TRIMESTRES[currentPeriodo].meses;
}

function updateTopbar() {
  const badge = document.getElementById('trimestre-badge');
  const range = document.getElementById('trimestre-range');
  if (currentPeriodo === -1) {
    badge.textContent = 'Todos os meses';
    range.textContent = String(anoAtual());
  } else {
    const t = TRIMESTRES[currentPeriodo];
    badge.textContent = t.nome;
    range.textContent = NOME_MES[t.meses[0]] + ' – ' + NOME_MES[t.meses[2]];
  }
  document.getElementById('page-title').textContent =
    (currentView === 'geral' ? 'Geral' : currentView) + ' — ' +
    (currentPeriodo === -1 ? 'Todos os meses' : TRIMESTRES[currentPeriodo].nome);
}

// ── Filtro
function fd(view, mes) {
  let d = allData;
  if (view !== 'geral') d = d.filter(r => r.colaborador.trim().toLowerCase() === view.trim().toLowerCase());
  return d.filter(r => r.mes === mes);
}

// ── Utilitários 
function sum(data, key) { return data.reduce((a, r) => a + (r[key] || 0), 0); }
function avg(data, key) { return data.length ? sum(data, key) / data.length : 0; }
function fmtNum(n)  { return Math.round(n).toLocaleString('pt-BR'); }
function fmtPct(n)  { return parseFloat(n).toFixed(1) + '%'; }
function fmtMin(n)  { const v = parseFloat(n); return isNaN(v) ? '—' : v.toFixed(1) + ' min'; }
function quotaColor(p) { return p >= 100 ? C.verde : p >= 60 ? C.ambar : C.vermelho; }
function quotaBadge(p) {
  if (p >= 100) return `<span class="quota-badge badge-green">✓ Atingida</span>`;
  if (p >= 60)  return `<span class="quota-badge badge-amber">⟳ Próxima</span>`;
  return `<span class="quota-badge badge-red">✕ Abaixo</span>`;
}

// ── Gráficos 
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function mkChart(id, cfg) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (ctx) charts[id] = new Chart(ctx, cfg);
}
function notasChart(id, dist) {
  mkChart(id, {
    type: 'bar',
    data: {
      labels: ['1','2','3','4','5'],
      datasets: [{ data: dist, backgroundColor:[C.vermelho,C.laranja,C.ambar,C.ciano,C.verde], borderRadius:4, borderSkipped:false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor:C.bloco, borderColor:C.divisoria, borderWidth:1, titleColor:C.label, bodyColor:'#fff',
          callbacks: { label: c => ' ' + fmtNum(c.parsed.y) + ' av.' } }
      },
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:10},color:C.label}, border:{color:C.divisoria} },
        y: { beginAtZero:true, grid:{color:'rgba(51,65,85,0.5)'}, ticks:{font:{size:9},color:C.label}, border:{color:C.divisoria} }
      }
    }
  });
}

// ── Card de um mês — GERAL
function geralMesHTML(mes, uid) {
  const data = fd('geral', mes);
  const nm   = NOME_MES[mes];
  if (!data.length) return `
    <div class="mes-section">
      <div class="mes-header"><span class="mes-titulo">${nm}</span><span class="mes-ano">${anoAtual()}</span></div>
      <div class="mes-empty">Sem dados para ${nm}</div>
    </div>`;

  const totalAts  = sum(data,'atendimentos');
  const cotaBase  = sum(data,'cota_pts');
  const ptsPres   = sum(data,'atend_presencial') * 200;
  const totalPts  = cotaBase + ptsPres + sum(data,'demanda_extra');
  const csatM     = avg(data,'csat');
  const totalNot  = sum(data,'nota1')+sum(data,'nota2')+sum(data,'nota3')+sum(data,'nota4')+sum(data,'nota5');
  const cotaEqPct = members.length ? Math.min(Math.round(totalPts/(META_COTA*members.length)*100),999) : 0;
  const tel=sum(data,'telecom'), clu=sum(data,'club'), intl=sum(data,'internacional');
  const setorT = tel+clu+intl||1;

  const quotaRows = members.map(m => {
    const mData = fd(m,mes);
    const pts = sum(mData,'cota_pts') + sum(mData,'atend_presencial') * 200 + sum(mData,'demanda_extra');
    const pct = Math.min(Math.round(pts/META_COTA*100),100);
    return `<div class="quota-row">
      <div class="quota-name">${m.split(' ')[0]}</div>
      <div class="quota-bar-bg"><div class="quota-bar-fill" style="width:${pct}%;background:${quotaColor(pct)}"></div></div>
      <div class="quota-pct" style="color:${quotaColor(pct)}">${pct}%</div>
      ${quotaBadge(pct)}
    </div>`;
  }).join('');

  return `
    <div class="mes-section">
      <div class="mes-header"><span class="mes-titulo">${nm}</span><span class="mes-ano">${anoAtual()}</span></div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Atendimentos</div><div class="kpi-value">${fmtNum(totalAts)}</div></div>
        <div class="kpi"><div class="kpi-label">CSAT médio</div><div class="kpi-value" style="color:#34D399">${fmtPct(csatM)}</div></div>
        <div class="kpi"><div class="kpi-label">Avaliações</div><div class="kpi-value">${fmtNum(totalNot)}</div></div>
        <div class="kpi"><div class="kpi-label">Pontos equipe</div><div class="kpi-value" style="color:#10B981">${fmtNum(totalPts)}<span style="font-size:11px;font-weight:400"> pts</span></div><div class="kpi-sub">${cotaEqPct}% da meta</div></div>
      </div>
      <div class="card">
        <div class="card-title">Avaliações por nota</div>
        <div class="chart-wrap" style="height:130px">
          <canvas id="chartAv_${uid}" role="img" aria-label="Avaliações ${nm}">Notas 1 a 5.</canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Cota por colaborador</div>
        ${quotaRows}
      </div>
      <div class="card">
        <div class="card-title">Atendimentos por setor</div>
        <div class="setor-row"><span class="setor-label">Telecom</span><span class="setor-val">${fmtNum(tel)}<span class="setor-pct">(${Math.round(tel/setorT*100)}%)</span></span></div>
        <div class="setor-row"><span class="setor-label">Club</span><span class="setor-val">${fmtNum(clu)}<span class="setor-pct">(${Math.round(clu/setorT*100)}%)</span></span></div>
        <div class="setor-row"><span class="setor-label">Internacional</span><span class="setor-val">${fmtNum(intl)}<span class="setor-pct">(${Math.round(intl/setorT*100)}%)</span></span></div>
      </div>
    </div>`;
}

// ── Card individual substituído pela nova versão com tabela de cota
// (função definida abaixo junto com tabelaCotaHTML)
function individualMesHTML_OLD_UNUSED(nome, mes, uid) {
  const data = fd(nome, mes);
  const nm   = NOME_MES[mes];
  if (!data.length) return `
    <div class="mes-section">
      <div class="mes-header"><span class="mes-titulo">${nm}</span><span class="mes-ano">${anoAtual()}</span></div>
      <div class="mes-empty">Sem dados para ${nm}</div>
    </div>`;

  const totalAts = sum(data,'atendimentos');
  const cotaBase = sum(data,'cota_pts');
  const totalPresencial2  = sum(data,'atend_presencial');
  const totalDemandaExtra = sum(data,'demanda_extra');
  const ptsPres    = totalPresencial2 * 200;
  const cotaBruta  = cotaBase + ptsPres + totalDemandaExtra;
  const csatM    = avg(data,'csat');
  const totalNot = sum(data,'nota1')+sum(data,'nota2')+sum(data,'nota3')+sum(data,'nota4')+sum(data,'nota5');
  const pctGeral = ((totalAts/(sum(fd('geral',mes),'atendimentos')||1))*100).toFixed(1);

  // Punições — Cota (pts) é bruta, líquida = bruta − punições
  const pun = {
    atraso:      sum(data,'p_atraso'),
    procedimento:sum(data,'p_procedimento'),
    celular:     sum(data,'p_celular'),
    omissao:     sum(data,'p_omissao'),
    uniforme:    sum(data,'p_uniforme'),
  };
  const totalPunicao = Object.values(pun).reduce((a,v)=>a+v,0);
  const totalPts     = Math.max(cotaBruta - totalPunicao, 0);
  const cotaPct      = Math.min(Math.round(totalPts/META_COTA*100),999);
  const color        = quotaColor(cotaPct);

  const punicaoRows = [
    { label:'Atraso',                 val: pun.atraso        },
    { label:'Procedimento incorreto', val: pun.procedimento  },
    { label:'Celular',                val: pun.celular       },
    { label:'Omissão de atendimento', val: pun.omissao       },
    { label:'Uniforme',               val: pun.uniforme      },
  ].map(p => `
    <div class="punicao-row${p.val > 0 ? ' punicao-ativa' : ''}">
      <span class="punicao-label">${p.label}</span>
      <span class="punicao-val">${p.val > 0 ? '−' + fmtNum(p.val) + ' pts' : '—'}</span>
    </div>`).join('');

  return `
    <div class="mes-section">
      <div class="mes-header"><span class="mes-titulo">${nm}</span><span class="mes-ano">${anoAtual()}</span></div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Atendimentos</div><div class="kpi-value">${fmtNum(totalAts)}</div><div class="kpi-sub">${pctGeral}% da equipe</div></div>
        <div class="kpi"><div class="kpi-label">CSAT</div><div class="kpi-value" style="color:#34D399">${fmtPct(csatM)}</div></div>
        <div class="kpi"><div class="kpi-label">Avaliações</div><div class="kpi-value">${fmtNum(totalNot)}</div></div>
        <div class="kpi"><div class="kpi-label">Cota líquida</div><div class="kpi-value" style="color:${color}">${fmtNum(totalPts)} pts</div><div class="kpi-sub">${cotaPct}% da meta</div></div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span class="card-title" style="margin:0">Cota líquida — meta 5.000 pts</span>
          <span style="font-size:11px;font-weight:700;color:${color}">${fmtNum(totalPts)} pts</span>
        </div>
        <div class="cota-bar-bg"><div class="cota-bar-fill" style="width:${Math.min(cotaPct,100)}%;background:${color}"></div></div>
        <div class="cota-labels"><span>0</span><span>5.000</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <div style="display:flex;gap:14px">
            <span style="font-size:11px;color:#64748B">TMA: <strong style="color:#CBD5E1">${fmtMin(avg(data,'tma'))}</strong></span>
            <span style="font-size:11px;color:#64748B">TME: <strong style="color:#CBD5E1">${fmtMin(avg(data,'tme'))}</strong></span>
          </div>
          <span style="font-size:11px;color:#64748B">Bruta: <strong style="color:#CBD5E1">${fmtNum(cotaBruta)} pts</strong></span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Avaliações por nota</div>
        <div class="chart-wrap" style="height:120px">
          <canvas id="chartInd_${uid}" role="img" aria-label="Avaliações ${nm}">Notas CSAT.</canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Descontos por ocorrência</div>
        ${punicaoRows}
        <div class="punicao-total">
          <span>Total de descontos</span>
          <span style="color:${totalPunicao>0?'#FCA5A5':'#64748B'}">${totalPunicao>0?'−'+fmtNum(totalPunicao)+' pts':'Sem descontos'}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Demanda extra</div>
        <div class="setor-row">
          <span class="setor-label">Atend. presencial</span>
          <span class="setor-val">${fmtNum(totalPresencial2)} <span class="setor-pct">(${fmtNum(ptsPres)} pts)</span></span>
        </div>
        <div class="setor-row">
          <span class="setor-label">Demanda extra (WhatsApp, chips, etc)</span>
          <span class="setor-val">${fmtNum(totalDemandaExtra)}</span>
        </div>
        <div class="punicao-total" style="color:var(--verde-dest)">
          <span>Total</span>
          <span>+${fmtNum(ptsPres + totalDemandaExtra)} pts</span>
        </div>
      </div>
    </div>`;
}

// ── Tabela de composição de cota individual ──────────────────────────────────
function tabelaCotaHTML(data, uid) {
  function linha(label, feito, pts, destaque) {
    const cota = feito * pts;
    const cor  = cota < 0 ? '#FCA5A5' : cota > 0 ? '#CBD5E1' : '#64748B';
    const cls  = destaque ? ' cota-linha-total' : '';
    return `<tr class="cota-linha${cls}">
      <td>${label}</td>
      <td style="text-align:right;color:#94A3B8">${pts > 0 ? '+' : ''}${pts}</td>
      <td style="text-align:right;color:#CBD5E1">${fmtNum(feito)}</td>
      <td style="text-align:right;color:${cor};font-weight:600">${cota >= 0 ? '' : ''}${fmtNum(cota)}</td>
    </tr>`;
  }

  const d = data;
  const w  = sum(d,'whatsapp'),   tr = sum(d,'transferencia');
  const t25= sum(d,'tme_25'),    t40= sum(d,'tme_40');
  const t1h= sum(d,'tme_1h'),    tal= sum(d,'tme_alem');
  const n1 = sum(d,'nota1'),     n2 = sum(d,'nota2');
  const n3 = sum(d,'nota3'),     n4 = sum(d,'nota4'), n5 = sum(d,'nota5');
  const pr = sum(d,'atend_presencial'), de = sum(d,'demanda_extra'), mo = sum(d,'monitoria');

  // Soma de pontos referente ao setor (campo preenchível no modal — lemos do localStorage)
  const pontosSetor = getPontosSetor(uid);

  const cotaBase =
    w*3 + tr*1 + t25*1 + t40*0.5 + t1h*0 + tal*(-1.5) +
    n1*(-5) + n2*(-4) + n3*(-3) + n4*4 + n5*5 +
    pr*200 + de*5 + mo;

  const cotaTotal = cotaBase + pontosSetor;

  return `<table class="cota-tabela">
    <thead>
      <tr>
        <th>Atendimentos / Tratativas</th>
        <th style="text-align:right">Pontuação</th>
        <th style="text-align:right">Feito</th>
        <th style="text-align:right">Cota</th>
      </tr>
    </thead>
    <tbody>
      ${linha('Whatsapp - Chat Huggy', w, 3)}
      ${linha('Transferências', tr, 1)}
      ${linha('TME — Até 25 min', t25, 1)}
      ${linha('TME — Até 40 min', t40, 0.5)}
      ${linha('TME — Até 1h', t1h, 0)}
      ${linha('TME — Além de 1h', tal, -1.5)}
      ${linha('(NPS) Nota 1', n1, -5)}
      ${linha('(NPS) Nota 2', n2, -4)}
      ${linha('(NPS) Nota 3', n3, -3)}
      ${linha('(NPS) Nota 4', n4, 4)}
      ${linha('(NPS) Nota 5', n5, 5)}
      ${linha('Atendimento Presencial', pr, 200)}
      ${linha('Demanda extra', de, 5)}
      <tr class="cota-linha"><td>Monitoria</td><td style="text-align:right;color:#94A3B8">—</td><td style="text-align:right;color:#CBD5E1">${fmtNum(mo)}</td><td style="text-align:right;color:${mo>=0?'#CBD5E1':'#FCA5A5'};font-weight:600">${fmtNum(mo)}</td></tr>
      <tr class="cota-linha-setor">
        <td>Pontos Ref. ao setor</td>
        <td style="text-align:right;color:#94A3B8">—</td>
        <td style="text-align:right;color:#CBD5E1">—</td>
        <td style="text-align:right">
          <input class="cota-setor-input" data-uid="${uid}" type="number" value="${pontosSetor}" placeholder="0" step="0.5">
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="cota-linha-total">
        <td colspan="3">Total de pontos</td>
        <td style="text-align:right;color:${cotaTotal>=5000?'#10B981':cotaTotal>=3000?'#F59E0B':'#EF4444'};font-size:14px;font-weight:700" id="cota-total-${uid}">${fmtNum(cotaTotal)} pts</td>
      </tr>
    </tfoot>
  </table>`;
}

// Pontos referente ao setor — salvo no localStorage por uid
function getPontosSetor(uid) {
  try { return parseFloat(localStorage.getItem('cota_setor_' + uid) || '0') || 0; }
  catch { return 0; }
}
function setPontosSetor(uid, val) {
  try { localStorage.setItem('cota_setor_' + uid, val); } catch {}
}

// Bind dos inputs de pontos de setor após render
function bindCotaSetorInputs() {
  document.querySelectorAll('.cota-setor-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const uid = inp.dataset.uid;
      const val = parseFloat(inp.value) || 0;
      setPontosSetor(uid, val);
      // Recalcula o total na linha
      const totalEl = document.getElementById('cota-total-' + uid);
      if (!totalEl) return;
      // Pega os dados da view atual
      const [tIdx, mIdx] = uid.split('_').map(Number);
      const mes = currentPeriodo === -1
        ? TODOS_MESES[tIdx * 3 + mIdx]
        : TRIMESTRES[currentPeriodo].meses[mIdx];
      const data = fd(currentView, mes);
      const w  = sum(data,'whatsapp'),   tr2 = sum(data,'transferencia');
      const t25= sum(data,'tme_25'),    t40 = sum(data,'tme_40');
      const t1h= sum(data,'tme_1h'),    tal = sum(data,'tme_alem');
      const n1 = sum(data,'nota1'),     n2  = sum(data,'nota2');
      const n3 = sum(data,'nota3'),     n4  = sum(data,'nota4'), n5 = sum(data,'nota5');
      const pr = sum(data,'atend_presencial'), de = sum(data,'demanda_extra');
      const base = w*3+tr2*1+t25*1+t40*0.5+t1h*0+tal*(-1.5)+n1*(-5)+n2*(-4)+n3*(-3)+n4*4+n5*5+pr*200+de*5;
      const total = base + val;
      const cor = total >= 5000 ? '#10B981' : total >= 3000 ? '#F59E0B' : '#EF4444';
      totalEl.textContent = fmtNum(total) + ' pts';
      totalEl.style.color = cor;
    });
  });
}

// ── Card individual — novo layout com tabela de cota ─────────────────────────
function individualMesHTML(nome, mes, uid) {
  const data = fd(nome, mes);
  const nm   = NOME_MES[mes];
  if (!data.length) return `
    <div class="mes-section">
      <div class="mes-header"><span class="mes-titulo">${nm}</span><span class="mes-ano">${anoAtual()}</span></div>
      <div class="mes-empty">Sem dados para ${nm}</div>
    </div>`;

  const totalAts = sum(data,'atendimentos');
  const csatM    = avg(data,'csat');
  const totalNot = sum(data,'nota1')+sum(data,'nota2')+sum(data,'nota3')+sum(data,'nota4')+sum(data,'nota5');
  const pctGeral = ((totalAts/(sum(fd('geral',mes),'atendimentos')||1))*100).toFixed(1);

  const pun = {
    atraso:      sum(data,'p_atraso'),
    procedimento:sum(data,'p_procedimento'),
    celular:     sum(data,'p_celular'),
    omissao:     sum(data,'p_omissao'),
    uniforme:    sum(data,'p_uniforme'),
  };
  const totalPunicao = Object.values(pun).reduce((a,v)=>a+v,0);

  const punicaoRows = [
    { label:'Atraso',                 val: pun.atraso        },
    { label:'Procedimento incorreto', val: pun.procedimento  },
    { label:'Celular',                val: pun.celular       },
    { label:'Omissão de atendimento', val: pun.omissao       },
    { label:'Uniforme',               val: pun.uniforme      },
  ].filter(p => p.val > 0).map(p => `
    <div class="punicao-row punicao-ativa">
      <span class="punicao-label">${p.label}</span>
      <span class="punicao-val">−${fmtNum(p.val)} pts</span>
    </div>`).join('') || `<div class="punicao-row"><span class="punicao-label" style="color:#64748B">Sem descontos</span></div>`;

  // Cota total = base calculada pela tabela + pontos setor
  const cotaBase = sum(data,'whatsapp')*3 + sum(data,'transferencia')*1 +
    sum(data,'tme_25')*1 + sum(data,'tme_40')*0.5 + sum(data,'tme_1h')*0 + sum(data,'tme_alem')*(-1.5) +
    sum(data,'nota1')*(-5) + sum(data,'nota2')*(-4) + sum(data,'nota3')*(-3) + sum(data,'nota4')*4 + sum(data,'nota5')*5 +
    sum(data,'atend_presencial')*200 + sum(data,'demanda_extra')*5;
  const pontosSetor = getPontosSetor(uid);
  const cotaTotal   = cotaBase + pontosSetor;
  const cotaPts     = sum(data,'cota_pts');
  const pctMeta     = (cotaPts / META_COTA * 100).toFixed(1);
  const corMeta     = cotaPts >= META_COTA ? '#10B981' : cotaPts >= META_COTA * 0.6 ? '#F59E0B' : '#EF4444';
  const totalWhats  = sum(data,'whatsapp');

  return `
    <div class="mes-section ind-mes">
      <div class="mes-header"><span class="mes-titulo">${nm}</span><span class="mes-ano">${anoAtual()}</span></div>
      <div class="kpi-row kpi-row-6">
        <div class="kpi"><div class="kpi-label">Whatsapp</div><div class="kpi-value">${fmtNum(totalWhats)}</div></div>
        <div class="kpi"><div class="kpi-label">C-SAT</div><div class="kpi-value">${fmtPct(csatM)}</div></div>
        <div class="kpi"><div class="kpi-label">Meta</div><div class="kpi-value">${fmtNum(META_COTA)}</div></div>
        <div class="kpi"><div class="kpi-label">% Meta</div><div class="kpi-value" style="color:${corMeta}">${pctMeta}%</div></div>
        <div class="kpi"><div class="kpi-label">Punições</div><div class="kpi-value" style="color:${totalPunicao>0?'#FCA5A5':'#94A3B8'}">${totalPunicao>0?'−'+fmtNum(totalPunicao):' — '}</div></div>
        <div class="kpi"><div class="kpi-label">Cota final</div><div class="kpi-value">${fmtNum(Math.max(sum(data,'cota_pts') - totalPunicao, 0))}</div><div class="kpi-sub">líquida − punições</div></div>
      </div>
      <div class="card">
        <div class="card-title">Composição da cota</div>
        ${tabelaCotaHTML(data, uid)}
      </div>
      ${totalPunicao > 0 ? `
      <div class="card">
        <div class="card-title">Descontos por ocorrência</div>
        ${punicaoRows}
        <div class="punicao-total"><span>Total de descontos</span><span style="color:#FCA5A5">−${fmtNum(totalPunicao)} pts</span></div>
      </div>` : ''}
    </div>`;
}

// ── Render de trimestre (modo geral = 3 colunas, modo individual = empilhado) 
function renderTrimestre(t, tIdx) {
  if (currentView === 'geral') {
    const htmlCols = t.meses.map((mes, i) => geralMesHTML(mes, `${tIdx}_${i}`)).join('');
    return `<div class="trimestre-grid">${htmlCols}</div>`;
  } else {
    // Individual: meses empilhados verticalmente
    return t.meses.map((mes, i) => individualMesHTML(currentView, mes, `${tIdx}_${i}`)).join('');
  }
}

function drawCharts(t, tIdx) {
  t.meses.forEach((mes, i) => {
    const uid  = `${tIdx}_${i}`;
    const data = currentView === 'geral' ? fd('geral', mes) : fd(currentView, mes);
    if (!data.length) return;
    const dist = [sum(data,'nota1'),sum(data,'nota2'),sum(data,'nota3'),sum(data,'nota4'),sum(data,'nota5')];
    const id   = currentView === 'geral' ? `chartAv_${uid}` : `chartInd_${uid}`;
    notasChart(id, dist);
  });
}

// ── Render principal 
function render() {
  // Redireciona para monitoria se for a view selecionada
  if (currentView === 'monitoria') {
    document.getElementById('period-controls').style.display = 'none';
    document.getElementById('page-title').textContent = 'Monitoria';
    if (typeof monRender === 'function') monRender();
    return;
  }
  document.getElementById('period-controls').style.display = '';

  updateTopbar();
  const content = document.getElementById('content');

  if (!allData.length) {
    content.innerHTML = `<div id="no-data-msg">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
      <p>Nenhuma planilha carregada</p>
      <span>Use o botão na barra lateral para importar o arquivo</span>
    </div>`;
    return;
  }

  if (currentPeriodo === -1) {
    content.innerHTML = TRIMESTRES.map((t, ti) => `
      <div class="trimestre-bloco">
        <div class="trimestre-label">${t.nome} — ${NOME_MES[t.meses[0]]} a ${NOME_MES[t.meses[2]]}</div>
        ${renderTrimestre(t, ti)}
      </div>
    `).join('');
    TRIMESTRES.forEach((t, ti) => drawCharts(t, ti));
  } else {
    content.innerHTML = renderTrimestre(TRIMESTRES[currentPeriodo], currentPeriodo);
    drawCharts(TRIMESTRES[currentPeriodo], currentPeriodo);
  }

  const footer = document.createElement('div');
  footer.id = 'footer';
  footer.textContent = 'Feito por: Agnes Angelim';
  content.appendChild(footer);
  content.scrollTop = 0;

  // Bind inputs de pontos de setor (visão individual)
  if (currentView !== 'geral' && currentView !== 'monitoria') {
    setTimeout(bindCotaSetorInputs, 50);
  }
}

// ── Eventos 
bindNavEvents();
document.getElementById('btn-prev').addEventListener('click', navPrev);
document.getElementById('btn-next').addEventListener('click', navNext);

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = ''; 
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const wb  = XLSX.read(evt.target.result, { type: 'array', cellDates: false, raw: false });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
      if (!raw.length) { alert('Planilha vazia.'); return; }

      allData = parseRows(raw);

      if (!allData.length) {
        const primeiraLinha = raw[0];
        const colunas = Object.keys(primeiraLinha);
        const colMes = colunas.find(c => c.trim().toLowerCase().includes('ordem'));
        const valorMes = colMes ? primeiraLinha[colMes] : '(não encontrada)';
        alert([
          'Nenhum dado encontrado.',
          '',
          'Diagnóstico:',
          '• Colunas: ' + colunas.slice(0,6).join(', '),
          '• Coluna de mês detectada: ' + (colMes || 'nenhuma'),
          '• Valor na 1ª linha: ' + valorMes,
          '',
          'A coluna deve se chamar "Mês (Ordem)" com valores como "2026-03".',
        ].join('\n'));
        return;
      }

      currentView    = 'geral';
      currentPeriodo = -1;
      buildSidebar();
      document.querySelector('[data-view="geral"]').classList.add('active');
      render();
    } catch (err) { alert('Erro: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
});