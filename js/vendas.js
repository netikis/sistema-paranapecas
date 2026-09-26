'use strict';
/* Parana Pecas — modulo Vendas / Saidas / Relatorio geral (vendas.html) */

const VS_COLECAO = 'caixa_lancamentos';
const VS_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const VS_CAMPOS = ['dia', 'qtd', 'desc', 'valor'];
const VS_TIPOS = {
  venda: { titulo: '🛒 Vendas', nomeBusca: 'venda', colDesc: 'DESCRIÇÃO DO PRODUTO', placeholder: 'Descrição do produto' },
  saida: { titulo: '📤 Saídas', nomeBusca: 'saída', colDesc: 'DESCRIÇÃO DA SAÍDA', placeholder: 'Descrição da saída (ex: compra de peças, conta de luz)' }
};

const vsHoje = new Date();
let vsDb = null;
let vsAuth = null;
let vsUsuario = null;
let vsAppAberto = false;
let vsEmpresaNome = 'PARANÁ PEÇAS';
let vsMes = { ano: vsHoje.getFullYear(), mes: vsHoje.getMonth() };
let vsAnoRelatorio = vsHoje.getFullYear();
let vsLancamentos = { venda: [], saida: [] };
let vsUnsubMes = null;
let vsRelatorioDados = null;
let vsBusca = { venda: { termo: '', escopo: 'mes' }, saida: { termo: '', escopo: 'mes' } };
let vsTodos = { venda: null, saida: null };

/* ---------- utilitários ---------- */
function vsMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function vsEscapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Aceita "1.234,56", "50,5" ou "50.5" */
function vsParseValor(txt) {
  let s = String(txt || '').replace(/[R$\s]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function vsNormalizar(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function vsDataBr(chave) { const p = String(chave).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function vsDiasNoMes(ano, mes) { return new Date(ano, mes + 1, 0).getDate(); }
function vsDataChave(ano, mes, dia) { return ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0'); }
function vsEhMesAtual() { return vsMes.ano === vsHoje.getFullYear() && vsMes.mes === vsHoje.getMonth(); }
function vsCampo(tipo, nome) { return document.getElementById(`in-${tipo}-${nome}`); }

function vsAviso(msg) {
  Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: msg, timer: 2500, showConfirmButton: false });
}

function vsErroFirestore(err) {
  console.error(err);
  const semPermissao = err && err.code === 'permission-denied';
  Swal.fire('Erro', semPermissao
    ? 'Sem permissão para acessar Vendas/Saídas. Publique as regras atualizadas do Firestore (arquivo firestore.rules) no Console do Firebase.'
    : 'Não foi possível acessar os dados: ' + (err && err.message ? err.message : err), 'error');
}

/* ---------- abas ---------- */
function vsAbrirAba(aba) {
  document.querySelectorAll('.vs-painel').forEach(p => p.classList.toggle('active', p.id === 'painel-' + aba));
  document.querySelectorAll('.vs-tab').forEach(b => b.classList.toggle('active', b.dataset.aba === aba));
  if (aba === 'relatorio') vsCarregarRelatorio();
  else vsCampo(aba, 'desc').focus();
}

/* ---------- vendas / saídas ---------- */
function vsMontarPainel(tipo) {
  const cfg = VS_TIPOS[tipo];
  document.getElementById('painel-' + tipo).innerHTML = `
    <div class="vs-topo">
      <h2>${cfg.titulo}</h2>
      <div class="vs-mes-nav">
        <button type="button" onclick="vsMudarMes(-1)" title="Mês anterior">◀</button>
        <span class="vs-mes-label" data-mes-label></span>
        <button type="button" onclick="vsMudarMes(1)" title="Próximo mês">▶</button>
      </div>
      <div class="vs-exportar">
        <button type="button" class="vs-btn-pdf" onclick="vsExportarMesPdf('${tipo}')" title="Salvar a tabela do mês em PDF">📄 PDF</button>
        <button type="button" class="vs-btn-excel" onclick="vsExportarMesExcel('${tipo}')" title="Salvar a tabela do mês em Excel">📊 EXCEL</button>
      </div>
    </div>
    <div class="vs-busca">
      <input type="search" id="busca-${tipo}" placeholder="🔍 Buscar ${cfg.nomeBusca} por descrição, valor ou data" autocomplete="off">
      <select id="escopo-${tipo}" title="Onde buscar">
        <option value="mes">Neste mês</option>
        <option value="todos">Em todos os meses</option>
      </select>
    </div>
    <div class="vs-card" id="card-${tipo}">
      <table class="vs-tabela">
        <thead><tr><th class="c-dia">DIA</th><th class="c-qtd">QUANTIDADE</th><th class="c-desc">${cfg.colDesc}</th><th class="c-valor">VALOR</th><th class="c-acoes"></th></tr></thead>
        <tbody id="linhas-${tipo}"></tbody>
        <tfoot>
          <tr class="vs-entrada">
            <td class="c-dia"><input type="number" id="in-${tipo}-dia" min="1" max="31"></td>
            <td class="c-qtd"><input type="number" id="in-${tipo}-qtd" min="1" value="1"></td>
            <td class="c-desc"><input type="text" id="in-${tipo}-desc" placeholder="${cfg.placeholder}" autocomplete="off"></td>
            <td class="c-valor"><input type="text" id="in-${tipo}-valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></td>
            <td class="c-acoes"><button type="button" onclick="vsAdicionar('${tipo}')" title="Adicionar">➕</button></td>
          </tr>
          <tr class="vs-total"><td colspan="3" id="total-rotulo-${tipo}">TOTAL DO MÊS</td><td class="c-valor" id="total-${tipo}">R$ 0,00</td><td class="c-acoes"></td></tr>
        </tfoot>
      </table>
    </div>
    <p class="vs-dica">Preencha a linha colorida e aperte <b>Enter</b> para adicionar. O valor é o total da linha.</p>`;

  VS_CAMPOS.forEach((nome, i) => {
    vsCampo(tipo, nome).addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (nome === 'valor' || vsLinhaCompleta(tipo)) return vsAdicionar(tipo);
      const proximo = vsCampo(tipo, VS_CAMPOS[i + 1]);
      proximo.focus();
      proximo.select();
    });
  });

  document.getElementById('busca-' + tipo).addEventListener('input', e => {
    vsBusca[tipo].termo = e.target.value;
    vsRenderTabela(tipo);
  });
  document.getElementById('escopo-' + tipo).addEventListener('change', e => {
    vsBusca[tipo].escopo = e.target.value;
    vsRenderTabela(tipo);
  });
}

function vsLinhaCompleta(tipo) {
  return vsCampo(tipo, 'desc').value.trim() !== '' && vsParseValor(vsCampo(tipo, 'valor').value) > 0;
}

function vsAtualizarCabecalhoMes() {
  const rotulo = VS_MESES[vsMes.mes] + ' ' + vsMes.ano;
  document.querySelectorAll('[data-mes-label]').forEach(el => { el.textContent = rotulo; });
  const maxDia = vsDiasNoMes(vsMes.ano, vsMes.mes);
  const diaPadrao = vsEhMesAtual() ? vsHoje.getDate() : 1;
  Object.keys(VS_TIPOS).forEach(tipo => {
    const inDia = vsCampo(tipo, 'dia');
    inDia.max = maxDia;
    inDia.value = diaPadrao;
  });
}

function vsOrdenar(a, b) {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  const ta = a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : Number.MAX_SAFE_INTEGER;
  const tb = b.criadoEm && b.criadoEm.toMillis ? b.criadoEm.toMillis() : Number.MAX_SAFE_INTEGER;
  return ta - tb;
}

function vsCarregarMes() {
  if (vsUnsubMes) vsUnsubMes();
  vsAtualizarCabecalhoMes();
  vsLancamentos = { venda: [], saida: [] };
  Object.keys(VS_TIPOS).forEach(tipo => vsRenderTabela(tipo));

  const inicio = vsDataChave(vsMes.ano, vsMes.mes, 1);
  const fim = vsDataChave(vsMes.ano, vsMes.mes, 31);
  vsUnsubMes = vsDb.collection(VS_COLECAO)
    .where('data', '>=', inicio)
    .where('data', '<=', fim)
    .onSnapshot(snap => {
      const novo = { venda: [], saida: [] };
      snap.forEach(doc => {
        const d = doc.data();
        if (novo[d.tipo]) novo[d.tipo].push(Object.assign({ id: doc.id }, d));
      });
      Object.keys(novo).forEach(tipo => novo[tipo].sort(vsOrdenar));
      vsLancamentos = novo;
      Object.keys(VS_TIPOS).forEach(tipo => vsRenderTabela(tipo));
    }, vsErroFirestore);

  if (typeof vsDespCarregarMes === 'function') vsDespCarregarMes();
}

/* Busca "todos os meses": carrega uma vez todos os lançamentos do tipo e filtra na tela */
const vsTodosPendente = { venda: false, saida: false };
function vsCarregarTodos(tipo) {
  if (vsTodos[tipo] || vsTodosPendente[tipo]) return;
  vsTodosPendente[tipo] = true;
  vsDb.collection(VS_COLECAO).where('tipo', '==', tipo).get().then(snap => {
    const lista = [];
    snap.forEach(doc => lista.push(Object.assign({ id: doc.id }, doc.data())));
    vsTodos[tipo] = lista.sort(vsOrdenar);
    vsTodosPendente[tipo] = false;
    vsRenderTabela(tipo);
  }).catch(err => {
    vsTodosPendente[tipo] = false;
    vsErroFirestore(err);
  });
}

/* Linhas que aparecem na tabela: o mês inteiro, ou o resultado da busca */
function vsListaVisivel(tipo) {
  const busca = vsBusca[tipo];
  const termo = vsNormalizar(busca.termo.trim());
  const todos = busca.escopo === 'todos';
  if (!termo) return { lista: vsLancamentos[tipo], buscando: false, todos: false, termo: '' };
  const base = todos ? (vsTodos[tipo] || []) : vsLancamentos[tipo];
  const lista = base.filter(l => vsNormalizar(`${l.desc} ${vsMoeda(l.valor)} ${l.valor} ${vsDataBr(l.data)}`).includes(termo));
  return { lista: lista, buscando: true, todos: todos, termo: busca.termo.trim() };
}

function vsRenderTabela(tipo) {
  const vis = vsListaVisivel(tipo);
  const lista = vis.lista;
  const carregandoTodos = vis.todos && !vsTodos[tipo];
  if (carregandoTodos) vsCarregarTodos(tipo);
  const card = document.getElementById('card-' + tipo);
  card.classList.toggle('vs-buscando', vis.buscando);
  card.classList.toggle('vs-buscando-todos', vis.todos);

  const vazio = carregandoTodos ? 'Buscando em todos os meses...'
    : vis.buscando ? `Nenhum resultado para "${vsEscapar(vis.termo)}".`
    : 'Nenhum lançamento neste mês.';
  const corpo = document.getElementById('linhas-' + tipo);
  corpo.innerHTML = (!lista.length || carregandoTodos)
    ? `<tr class="vs-vazio"><td colspan="5">${vazio}</td></tr>`
    : lista.map(l => `
      <tr>
        <td class="c-dia">${vsEscapar(vis.todos ? vsDataBr(l.data) : String(l.data).slice(8))}</td>
        <td class="c-qtd">${vsEscapar(l.qtd || 1)}</td>
        <td class="c-desc">${vsEscapar(l.desc)}</td>
        <td class="c-valor">${vsMoeda(l.valor)}</td>
        <td class="c-acoes"><button type="button" class="vs-btn-excluir" onclick="vsExcluir('${l.id}')" title="Excluir">🗑️</button></td>
      </tr>`).join('');

  const total = carregandoTodos ? 0 : lista.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  document.getElementById('total-' + tipo).textContent = vsMoeda(total);
  document.getElementById('total-rotulo-' + tipo).textContent = vis.buscando
    ? `TOTAL ENCONTRADO (${carregandoTodos ? 0 : lista.length})`
    : 'TOTAL DO MÊS';
}

function vsMudarMes(delta) {
  const d = new Date(vsMes.ano, vsMes.mes + delta, 1);
  vsMes = { ano: d.getFullYear(), mes: d.getMonth() };
  vsCarregarMes();
}

function vsAdicionar(tipo) {
  const maxDia = vsDiasNoMes(vsMes.ano, vsMes.mes);
  const dia = parseInt(vsCampo(tipo, 'dia').value, 10);
  const qtd = parseInt(vsCampo(tipo, 'qtd').value, 10) || 1;
  const desc = vsCampo(tipo, 'desc').value.trim();
  const valor = vsParseValor(vsCampo(tipo, 'valor').value);

  if (!dia || dia < 1 || dia > maxDia) {
    vsCampo(tipo, 'dia').focus();
    vsCampo(tipo, 'dia').select();
    return vsAviso(`Dia inválido: use de 1 a ${maxDia}.`);
  }
  if (!desc) return vsCampo(tipo, 'desc').focus();
  if (valor <= 0) {
    vsCampo(tipo, 'valor').focus();
    return vsAviso('Informe o valor.');
  }

  vsDb.collection(VS_COLECAO).add({
    tipo: tipo,
    data: vsDataChave(vsMes.ano, vsMes.mes, dia),
    qtd: qtd,
    desc: desc.toUpperCase(),
    valor: valor,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    criadoPor: vsUsuario ? vsUsuario.email : ''
  }).catch(vsErroFirestore);
  vsTodos[tipo] = null;

  vsCampo(tipo, 'qtd').value = 1;
  vsCampo(tipo, 'desc').value = '';
  vsCampo(tipo, 'valor').value = '';
  vsCampo(tipo, 'qtd').focus();
  vsCampo(tipo, 'qtd').select();
}

function vsExcluir(id) {
  Swal.fire({
    title: 'Excluir este lançamento?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar'
  }).then(r => {
    if (!r.isConfirmed) return;
    vsDb.collection(VS_COLECAO).doc(id).delete().then(() => {
      Object.keys(vsTodos).forEach(tipo => {
        if (!vsTodos[tipo]) return;
        vsTodos[tipo] = vsTodos[tipo].filter(l => l.id !== id);
        vsRenderTabela(tipo);
      });
    }).catch(vsErroFirestore);
  });
}

/* ---------- relatório geral (balancete) ---------- */
function vsMudarAno(delta) {
  vsAnoRelatorio += delta;
  vsCarregarRelatorio();
}

function vsCarregarRelatorio() {
  const ano = vsAnoRelatorio;
  document.getElementById('vsAnoLabel').textContent = ano;
  document.getElementById('vsBalanceteLinhas').innerHTML = '<tr class="vs-vazio"><td colspan="4">Carregando...</td></tr>';

  vsDb.collection(VS_COLECAO)
    .where('data', '>=', ano + '-01-01')
    .where('data', '<=', ano + '-12-31')
    .get()
    .then(snap => {
      if (ano !== vsAnoRelatorio) return;
      const meses = VS_MESES.map(() => ({ venda: 0, saida: 0 }));
      const lanc = { venda: [], saida: [] };
      snap.forEach(doc => {
        const d = doc.data();
        const m = parseInt(String(d.data).slice(5, 7), 10) - 1;
        if (!meses[m] || !lanc[d.tipo]) return;
        meses[m][d.tipo] += Number(d.valor) || 0;
        lanc[d.tipo].push(Object.assign({ id: doc.id }, d));
      });
      Object.keys(lanc).forEach(tipo => lanc[tipo].sort(vsOrdenar));
      vsRelatorioDados = { ano: ano, meses: meses, lanc: lanc };
      vsRenderRelatorio(ano, meses);
    })
    .catch(vsErroFirestore);
}

function vsTotaisAno(meses) {
  return meses.reduce((t, m) => ({ venda: t.venda + m.venda, saida: t.saida + m.saida }), { venda: 0, saida: 0 });
}

function vsRenderRelatorio(ano, meses) {
  let totVendas = 0;
  let totSaidas = 0;
  document.getElementById('vsBalanceteLinhas').innerHTML = meses.map((m, i) => {
    totVendas += m.venda;
    totSaidas += m.saida;
    const saldo = m.venda - m.saida;
    const classeLinha = (ano === vsHoje.getFullYear() && i === vsHoje.getMonth()) ? 'vs-mes-atual' : '';
    return `<tr class="${classeLinha}" onclick="vsIrParaMes(${ano}, ${i})" title="Abrir ${VS_MESES[i]} em Vendas">
      <td>${VS_MESES[i]}</td>
      <td>${vsMoeda(m.venda)}</td>
      <td>${vsMoeda(m.saida)}</td>
      <td class="${saldo < 0 ? 'vs-negativo' : 'vs-positivo'}">${vsMoeda(saldo)}</td>
    </tr>`;
  }).join('');

  const saldoAno = totVendas - totSaidas;
  document.getElementById('vsTotVendas').textContent = vsMoeda(totVendas);
  document.getElementById('vsTotSaidas').textContent = vsMoeda(totSaidas);
  document.getElementById('vsTotSaldo').textContent = vsMoeda(saldoAno);
  document.getElementById('vsAnoVendas').textContent = vsMoeda(totVendas);
  document.getElementById('vsAnoSaidas').textContent = vsMoeda(totSaidas);
  document.getElementById('vsAnoSaldo').textContent = vsMoeda(saldoAno);
}

function vsIrParaMes(ano, mes) {
  vsMes = { ano: ano, mes: mes };
  vsCarregarMes();
  vsAbrirAba('venda');
}

window.addEventListener('beforeprint', () => {
  const abaAtiva = document.querySelector('.vs-tab.active');
  const aba = abaAtiva ? abaAtiva.dataset.aba : 'venda';
  const periodo = aba === 'relatorio' ? 'Balancete ' + vsAnoRelatorio : VS_MESES[vsMes.mes] + ' ' + vsMes.ano;
  document.getElementById('vsPrintCab').innerHTML =
    `<b>${vsEscapar(vsEmpresaNome)}</b><br>${periodo} — impresso em ${new Date().toLocaleString('pt-BR')}`;
});

/* ---------- inicialização ---------- */
function vsCarregarEmpresa() {
  vsDb.collection('config').doc('empresa').get().then(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    const emp = d.ativo === 2 ? d.emp2 : d.emp1;
    const nome = (emp && emp.nome) || d.nome;
    if (nome) vsEmpresaNome = nome;
  }).catch(() => {});
}

function vsAbrirApp() {
  if (vsAppAberto) return;
  vsAppAberto = true;
  document.getElementById('vsCarregando').hidden = true;
  document.getElementById('vsApp').hidden = false;
  Object.keys(VS_TIPOS).forEach(tipo => vsMontarPainel(tipo));
  if (typeof vsDespMontarPainel === 'function') vsDespMontarPainel();
  vsCarregarEmpresa();
  vsCarregarMes();
  vsAbrirAba('venda');
}

function vsIniciar() {
  const cfg = window.PARANA_FIREBASE_CONFIG || window.FIREBASE_CONFIG;
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  vsDb = firebase.firestore();
  vsAuth = firebase.auth();

  const seguir = () => vsAuth.onAuthStateChanged(user => {
    if (!user) {
      window.location.replace('index.html');
      return;
    }
    vsUsuario = user;
    vsDb.collection('usuarios').doc(user.uid).get().then(doc => {
      const perfil = doc.exists ? doc.data().perfil : 'admin';
      const nome = doc.exists ? doc.data().nome : user.email;
      if (perfil !== 'admin') {
        Swal.fire('Acesso restrito', 'O módulo Vendas/Saídas é só para administradores.', 'warning')
          .then(() => window.location.replace('index.html'));
        return;
      }
      document.getElementById('vsUsuario').textContent = '👤 ' + nome;
      vsAbrirApp();
    }).catch(vsErroFirestore);
  });
  vsAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION).then(seguir).catch(seguir);
}

vsIniciar();
