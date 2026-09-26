'use strict';
/* Parana Pecas — Tabela de despesa mensal (vendas.html, depende de js/vendas.js) */

const VS_DESP_COLECAO = 'despesas_mensais';
let vsDespesas = [];
let vsDespUnsub = null;
const vsDespSel = new Set();
/* Pilha de exclusoes para o "desfazer": cada item e a lista de despesas apagadas de uma vez */
const vsDespLixeira = [];

function vsMesChave(ano, mes) { return ano + '-' + String(mes + 1).padStart(2, '0'); }

function vsDespMontarPainel() {
  document.getElementById('painel-despesa').innerHTML = `
    <div class="vs-topo">
      <h2>🧾 Tabela de Despesa Mensal</h2>
      <div class="vs-mes-nav">
        <button type="button" onclick="vsMudarMes(-1)" title="Mês anterior">◀</button>
        <span class="vs-mes-label" data-mes-label></span>
        <button type="button" onclick="vsMudarMes(1)" title="Próximo mês">▶</button>
      </div>
      <div class="vs-exportar">
        <button type="button" class="vs-btn-copiar" onclick="vsDespCopiarMesAnterior()" title="Traz as despesas do mês anterior para este mês (tabela toda ou só as fixas)">📋 Copiar mês anterior</button>
        <button type="button" class="vs-btn-pdf" onclick="vsExportarDespesaPdf()" title="Salvar as despesas do mês em PDF">📄 PDF</button>
        <button type="button" class="vs-btn-excel" onclick="vsExportarDespesaExcel()" title="Salvar as despesas do mês em Excel">📊 EXCEL</button>
      </div>
    </div>
    <div class="vs-desp-acoes">
      <button type="button" class="vs-btn-forn" onclick="vsDespFornecedor()">🏭 ADICIONAR PAGAMENTO FORNECEDOR</button>
      <button type="button" class="vs-btn-desfazer" id="despDesfazer" onclick="vsDespDesfazer()" hidden>↩️ DESFAZER EXCLUSÃO</button>
    </div>
    <div class="vs-sel-barra" id="despSelBarra" hidden>
      <span id="despSelInfo"></span>
      <button type="button" class="vs-btn-excluir-sel" onclick="vsDespExcluirSelecionadas()">🗑️ EXCLUIR SELEÇÃO</button>
      <button type="button" class="vs-btn-limpar-sel" onclick="vsDespLimparSelecao()">LIMPAR SELEÇÃO</button>
    </div>
    <div class="vs-card">
      <table class="vs-tabela">
        <thead><tr><th class="c-sel"><input type="checkbox" id="despSelTodos" title="Selecionar todas as despesas do mês"></th><th class="c-desc">DESCRIÇÃO</th><th class="c-valor">VALOR</th><th class="c-acoes2"></th></tr></thead>
        <tbody id="linhas-despesa"></tbody>
        <tfoot>
          <tr class="vs-entrada">
            <td class="c-sel"></td>
            <td class="c-desc"><input type="text" id="in-despesa-desc" placeholder="Descrição da despesa (ex: aluguel, luz, internet)" autocomplete="off"></td>
            <td class="c-valor"><input type="text" id="in-despesa-valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></td>
            <td class="c-acoes2"><button type="button" onclick="vsDespAdicionar()" title="Adicionar">➕</button></td>
          </tr>
          <tr class="vs-total"><td class="c-sel"></td><td class="vs-total-rotulo">TOTAL DE DESPESAS</td><td class="c-valor" id="total-despesa">R$ 0,00</td><td class="c-acoes2"></td></tr>
        </tfoot>
      </table>
    </div>
    <p class="vs-dica">Digite a descrição, aperte <b>Enter</b>, digite o valor e aperte <b>Enter</b> de novo para adicionar.
      Marque as caixinhas para excluir várias de uma vez (a do cabeçalho marca todas).</p>`;

  document.getElementById('despSelTodos').addEventListener('change', e => {
    vsDespSel.clear();
    if (e.target.checked) vsDespesas.forEach(d => vsDespSel.add(d.id));
    vsDespAtualizarSelecao();
  });
  document.getElementById('linhas-despesa').addEventListener('change', e => {
    if (!e.target.classList.contains('desp-sel')) return;
    if (e.target.checked) vsDespSel.add(e.target.dataset.id);
    else vsDespSel.delete(e.target.dataset.id);
    vsDespAtualizarSelecao();
  });

  vsCampo('despesa', 'desc').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (vsParseValor(vsCampo('despesa', 'valor').value) > 0) return vsDespAdicionar();
    vsCampo('despesa', 'valor').focus();
    vsCampo('despesa', 'valor').select();
  });
  vsCampo('despesa', 'valor').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    vsDespAdicionar();
  });
}

function vsDespOrdenar(a, b) {
  return (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
}

function vsDespCarregarMes() {
  if (!document.getElementById('linhas-despesa')) return;
  if (vsDespUnsub) vsDespUnsub();
  vsDespesas = [];
  vsDespSel.clear();
  vsDespRender();

  const chave = vsMesChave(vsMes.ano, vsMes.mes);
  vsDespUnsub = vsDb.collection(VS_DESP_COLECAO)
    .where('mes', '==', chave)
    .onSnapshot(snap => {
      const lista = [];
      snap.forEach(doc => lista.push(Object.assign({ id: doc.id }, doc.data())));
      vsDespesas = lista.sort(vsDespOrdenar);
      vsDespRender();
    }, vsErroFirestore);
}

function vsDespRender() {
  const ids = new Set(vsDespesas.map(d => d.id));
  Array.from(vsDespSel).forEach(id => { if (!ids.has(id)) vsDespSel.delete(id); });

  document.getElementById('linhas-despesa').innerHTML = !vsDespesas.length
    ? '<tr class="vs-vazio"><td colspan="4">Nenhuma despesa cadastrada neste mês.</td></tr>'
    : vsDespesas.map(d => `
      <tr data-id="${d.id}">
        <td class="c-sel"><input type="checkbox" class="desp-sel" data-id="${d.id}" title="Selecionar"></td>
        <td class="c-desc">${vsDespDescricaoHtml(d)}</td>
        <td class="c-valor">${vsMoeda(d.valor)}</td>
        <td class="c-acoes2">
          <button type="button" class="vs-btn-editar" onclick="vsDespEditar('${d.id}')" title="Editar">✏️</button>
          <button type="button" class="vs-btn-excluir" onclick="vsDespExcluir('${d.id}')" title="Excluir">🗑️</button>
        </td>
      </tr>`).join('');
  const total = vsDespesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  document.getElementById('total-despesa').textContent = vsMoeda(total);
  vsDespAtualizarSelecao();
}

/* ---------- seleção ---------- */
function vsDespAtualizarSelecao() {
  const selecionadas = vsDespesas.filter(d => vsDespSel.has(d.id));
  document.querySelectorAll('#linhas-despesa tr[data-id]').forEach(tr => {
    const marcada = vsDespSel.has(tr.dataset.id);
    tr.classList.toggle('vs-selecionada', marcada);
    tr.querySelector('.desp-sel').checked = marcada;
  });

  const todos = document.getElementById('despSelTodos');
  todos.checked = selecionadas.length > 0 && selecionadas.length === vsDespesas.length;
  todos.indeterminate = selecionadas.length > 0 && selecionadas.length < vsDespesas.length;

  document.getElementById('despSelBarra').hidden = !selecionadas.length;
  const tudo = selecionadas.length === vsDespesas.length;
  document.getElementById('despSelInfo').innerHTML =
    `<b>${selecionadas.length}</b> ${selecionadas.length === 1 ? 'despesa selecionada' : 'despesas selecionadas'}${tudo ? ' (todas)' : ''} — ${vsMoeda(vsTotal(selecionadas))}`;
}

function vsDespLimparSelecao() {
  vsDespSel.clear();
  vsDespAtualizarSelecao();
}

function vsDespExcluirSelecionadas() {
  const lista = vsDespesas.filter(d => vsDespSel.has(d.id));
  if (!lista.length) return;
  const tudo = lista.length === vsDespesas.length;
  Swal.fire({
    title: tudo ? 'Excluir TODAS as despesas do mês?' : `Excluir ${lista.length} despesa(s) selecionada(s)?`,
    html: `Total: <b>${vsMoeda(vsTotal(lista))}</b><br><small>Se excluir errado, use o botão ↩️ Desfazer.</small>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar'
  }).then(r => { if (r.isConfirmed) vsDespApagar(lista); });
}

/* ---------- exclusão com desfazer ---------- */
function vsDespApagar(lista) {
  const lote = vsDb.batch();
  lista.forEach(d => lote.delete(vsDb.collection(VS_DESP_COLECAO).doc(d.id)));
  return lote.commit().then(() => {
    vsDespLixeira.push(lista.map(d => {
      const dados = Object.assign({}, d);
      delete dados.id;
      return { id: d.id, dados: dados };
    }));
    lista.forEach(d => vsDespSel.delete(d.id));
    vsDespAtualizarDesfazer();
    Swal.fire({
      toast: true, position: 'bottom', icon: 'info',
      title: lista.length === 1 ? 'Despesa excluída.' : `${lista.length} despesas excluídas.`,
      showConfirmButton: true, confirmButtonText: '↩️ Desfazer', confirmButtonColor: '#546e7a',
      timer: 8000, timerProgressBar: true
    }).then(r => { if (r.isConfirmed) vsDespDesfazer(); });
  }).catch(vsErroFirestore);
}

function vsDespAtualizarDesfazer() {
  const btn = document.getElementById('despDesfazer');
  const ultima = vsDespLixeira[vsDespLixeira.length - 1];
  btn.hidden = !ultima;
  if (ultima) btn.textContent = `↩️ DESFAZER EXCLUSÃO (${ultima.length === 1 ? ultima[0].dados.desc : ultima.length + ' despesas'})`;
}

function vsDespDesfazer() {
  const ultima = vsDespLixeira.pop();
  if (!ultima) return;
  const lote = vsDb.batch();
  ultima.forEach(item => lote.set(vsDb.collection(VS_DESP_COLECAO).doc(item.id), item.dados));
  lote.commit().then(() => {
    vsDespAtualizarDesfazer();
    const chaveAtual = vsMesChave(vsMes.ano, vsMes.mes);
    const outroMes = ultima.find(item => item.dados.mes !== chaveAtual);
    let onde = '';
    if (outroMes) {
      const p = String(outroMes.dados.mes).split('-');
      onde = ` em ${VS_MESES[parseInt(p[1], 10) - 1]} ${p[0]}`;
    }
    Swal.fire({
      toast: true, position: 'bottom', icon: 'success', timer: 3000, showConfirmButton: false,
      title: (ultima.length === 1 ? 'Despesa restaurada' : `${ultima.length} despesas restauradas`) + onde + '.'
    });
  }).catch(err => {
    vsDespLixeira.push(ultima);
    vsDespAtualizarDesfazer();
    vsErroFirestore(err);
  });
}

function vsDespNovoDoc(desc, valor, posicao) {
  return {
    mes: vsMesChave(vsMes.ano, vsMes.mes),
    desc: desc.toUpperCase(),
    valor: valor,
    ordem: Date.now() + (posicao || 0),
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    criadoPor: vsUsuario ? vsUsuario.email : ''
  };
}

function vsDespAdicionar() {
  const desc = vsCampo('despesa', 'desc').value.trim();
  const valor = vsParseValor(vsCampo('despesa', 'valor').value);
  if (!desc) return vsCampo('despesa', 'desc').focus();
  if (valor <= 0) {
    vsCampo('despesa', 'valor').focus();
    return vsAviso('Informe o valor.');
  }
  vsDb.collection(VS_DESP_COLECAO).add(vsDespNovoDoc(desc, valor)).catch(vsErroFirestore);
  vsCampo('despesa', 'desc').value = '';
  vsCampo('despesa', 'valor').value = '';
  vsCampo('despesa', 'desc').focus();
}

function vsDespEditar(id) {
  const d = vsDespesas.find(x => x.id === id);
  if (!d) return;
  if (d.tipo === 'fornecedor') return vsDespFornecedor(id);
  Swal.fire({
    title: 'Editar despesa',
    html: `<input id="swDespDesc" class="swal2-input" placeholder="Descrição" value="${vsEscapar(d.desc)}">
           <input id="swDespValor" class="swal2-input" placeholder="Valor" inputmode="decimal" value="${vsEscapar(Number(d.valor).toFixed(2).replace('.', ','))}">`,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    didOpen: () => document.getElementById('swDespValor').select(),
    preConfirm: () => {
      const desc = document.getElementById('swDespDesc').value.trim();
      const valor = vsParseValor(document.getElementById('swDespValor').value);
      if (!desc || valor <= 0) {
        Swal.showValidationMessage('Preencha a descrição e um valor maior que zero.');
        return false;
      }
      return { desc: desc.toUpperCase(), valor: valor };
    }
  }).then(r => {
    if (r.isConfirmed) vsDb.collection(VS_DESP_COLECAO).doc(id).update(r.value).catch(vsErroFirestore);
  });
}

/* ---------- pagamento fornecedor (varios boletos somados numa linha) ---------- */
function vsDespRotulo(d) {
  return d.tipo === 'fornecedor' ? 'PAGAMENTO FORNECEDOR - ' + (d.desc || '') : (d.desc || '');
}

function vsDespDescricaoHtml(d) {
  if (d.tipo !== 'fornecedor') return vsEscapar(d.desc);
  const boletos = d.boletos || [];
  return `<span class="vs-tag-forn">🏭 FORNECEDOR</span> ${vsEscapar(d.desc)}
    <span class="vs-forn-qtd">(${boletos.length} ${boletos.length === 1 ? 'boleto' : 'boletos'})</span>
    <div class="vs-forn-detalhe">${boletos.map(b =>
      `<div><span>${vsEscapar(b.desc || 'BOLETO')}</span><span>${vsMoeda(b.valor)}</span></div>`).join('')}</div>`;
}

function vsFornLer() {
  return Array.from(document.querySelectorAll('#fornLinhas tr')).map(tr => ({
    desc: tr.querySelector('.forn-desc').value.trim().toUpperCase(),
    valorTxt: tr.querySelector('.forn-valor').value.trim(),
    valor: vsParseValor(tr.querySelector('.forn-valor').value)
  }));
}

function vsFornTotal() {
  const total = vsFornLer().reduce((s, b) => s + b.valor, 0);
  document.getElementById('fornTotal').textContent = vsMoeda(total);
}

function vsFornAddLinha(boleto, focar) {
  const corpo = document.getElementById('fornLinhas');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="forn-desc" placeholder="Ex: Boleto NF 1234 - venc. 10/09" autocomplete="off"></td>
    <td><input type="text" class="forn-valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></td>
    <td><button type="button" class="vs-btn-excluir" title="Remover linha">✖</button></td>`;
  const inDesc = tr.querySelector('.forn-desc');
  const inValor = tr.querySelector('.forn-valor');
  if (boleto) {
    inDesc.value = boleto.desc || '';
    inValor.value = boleto.valor ? Number(boleto.valor).toFixed(2).replace('.', ',') : '';
  }

  inValor.addEventListener('input', vsFornTotal);
  inDesc.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    inValor.focus();
  });
  inValor.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const proxima = tr.nextElementSibling;
    if (proxima) return proxima.querySelector('.forn-desc').focus();
    if (!inDesc.value.trim() && !inValor.value.trim()) return Swal.clickConfirm();
    vsFornAddLinha(null, true);
  });
  tr.querySelector('button').addEventListener('click', () => {
    if (corpo.children.length > 1) tr.remove();
    else { inDesc.value = ''; inValor.value = ''; }
    vsFornTotal();
  });

  corpo.appendChild(tr);
  if (focar) inDesc.focus();
}

function vsDespFornecedor(id) {
  const existente = id ? vsDespesas.find(x => x.id === id) : null;
  const boletos = existente && existente.boletos && existente.boletos.length ? existente.boletos : [null];

  Swal.fire({
    title: existente ? '✏️ Editar pagamento fornecedor' : '🏭 Pagamento fornecedor',
    width: 720,
    html: `
      <div class="vs-forn">
        <label for="fornNome">Fornecedor</label>
        <input type="text" id="fornNome" placeholder="Nome do fornecedor (ex: CHG)" autocomplete="off" value="${vsEscapar(existente ? existente.desc : '')}">
        <table class="vs-forn-tabela">
          <thead><tr><th>BOLETO / DESCRIÇÃO</th><th class="forn-c-valor">VALOR</th><th class="forn-c-acao"></th></tr></thead>
          <tbody id="fornLinhas"></tbody>
          <tfoot><tr><td>TOTAL</td><td id="fornTotal" class="forn-c-valor">R$ 0,00</td><td></td></tr></tfoot>
        </table>
        <button type="button" id="fornAddLinha" class="vs-forn-add">➕ ADICIONAR LINHA</button>
        <p class="vs-forn-dica">Enter no valor cria a próxima linha. Enter numa linha vazia salva.</p>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '💾 Salvar na tabela',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2e7d32',
    focusConfirm: false,
    didOpen: () => {
      boletos.forEach(b => vsFornAddLinha(b, false));
      vsFornTotal();
      document.getElementById('fornAddLinha').addEventListener('click', () => vsFornAddLinha(null, true));
      const inNome = document.getElementById('fornNome');
      inNome.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        document.querySelector('#fornLinhas .forn-desc').focus();
      });
      if (existente) document.querySelector('#fornLinhas .forn-valor').focus();
      else inNome.focus();
    },
    preConfirm: () => {
      const nome = document.getElementById('fornNome').value.trim();
      if (!nome) {
        Swal.showValidationMessage('Informe o nome do fornecedor.');
        return false;
      }
      const linhas = vsFornLer().filter(b => b.desc || b.valorTxt);
      if (linhas.some(b => b.valor <= 0)) {
        Swal.showValidationMessage('Tem linha sem valor. Preencha o valor ou remova a linha (✖).');
        return false;
      }
      if (!linhas.length) {
        Swal.showValidationMessage('Adicione pelo menos um boleto com valor.');
        return false;
      }
      const lista = linhas.map(b => ({ desc: b.desc, valor: b.valor }));
      const total = Math.round(lista.reduce((s, b) => s + b.valor, 0) * 100) / 100;
      return { desc: nome.toUpperCase(), boletos: lista, valor: total };
    }
  }).then(r => {
    if (!r.isConfirmed) return;
    const ref = vsDb.collection(VS_DESP_COLECAO);
    const salvar = existente
      ? ref.doc(existente.id).update(r.value)
      : ref.add(Object.assign(vsDespNovoDoc(r.value.desc, r.value.valor), { tipo: 'fornecedor', boletos: r.value.boletos }));
    salvar.catch(vsErroFirestore);
  });
}

function vsDespExcluir(id) {
  const d = vsDespesas.find(x => x.id === id);
  if (!d) return;
  Swal.fire({
    title: 'Excluir esta despesa?',
    text: `${vsDespRotulo(d)} — ${vsMoeda(d.valor)}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar'
  }).then(r => { if (r.isConfirmed) vsDespApagar([d]); });
}

/* Copia as despesas do mes anterior para o mes aberto: a tabela toda ou so as fixas */
function vsDespCopiarMesAnterior() {
  const ant = new Date(vsMes.ano, vsMes.mes - 1, 1);
  const chaveAnt = vsMesChave(ant.getFullYear(), ant.getMonth());
  const nomeAnt = VS_MESES[ant.getMonth()] + ' ' + ant.getFullYear();

  vsDb.collection(VS_DESP_COLECAO).where('mes', '==', chaveAnt).get().then(snap => {
    const todas = [];
    snap.forEach(doc => todas.push(doc.data()));
    if (!todas.length) return vsAviso(`Nenhuma despesa em ${nomeAnt} para copiar.`);
    todas.sort(vsDespOrdenar);
    const fixas = todas.filter(d => d.tipo !== 'fornecedor');
    const nForn = todas.length - fixas.length;

    const jaTem = vsDespesas.length
      ? `<br><br><small>Este mês já tem ${vsDespesas.length} despesa(s); as copiadas serão adicionadas junto.</small>`
      : '';
    return Swal.fire({
      title: `Copiar de ${nomeAnt}?`,
      html: `${nomeAnt} tem <b>${fixas.length}</b> despesa(s) fixa(s) e <b>${nForn}</b> pagamento(s) de fornecedor.${jaTem}`,
      icon: 'question',
      showCancelButton: true,
      showDenyButton: nForn > 0 && fixas.length > 0,
      confirmButtonText: `📋 Copiar tabela toda (${todas.length})`,
      denyButtonText: `Só despesas fixas (${fixas.length})`,
      denyButtonColor: '#6a1b9a',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed) return vsDespCopiarLista(todas);
      if (r.isDenied) return vsDespCopiarLista(fixas);
    });
  }).catch(vsErroFirestore);
}

function vsDespCopiarLista(origem) {
  const lote = vsDb.batch();
  origem.forEach((d, i) => {
    const novo = vsDespNovoDoc(d.desc || '', Number(d.valor) || 0, i);
    if (d.tipo === 'fornecedor') {
      novo.tipo = 'fornecedor';
      novo.boletos = (d.boletos || []).map(b => ({ desc: b.desc || '', valor: Number(b.valor) || 0 }));
    }
    lote.set(vsDb.collection(VS_DESP_COLECAO).doc(), novo);
  });
  return lote.commit().then(() => Swal.fire({
    toast: true, position: 'top-end', icon: 'success', timer: 3500, showConfirmButton: false,
    title: `${origem.length} despesa(s) copiada(s). Ajuste os valores com ✏️ se precisar.`
  })).catch(vsErroFirestore);
}
