'use strict';
/* Paraná Peças — Módulo Pedidos a Fornecedores (pedidos_fornecedores) */

const PF_COLECAO = 'pedidos_fornecedores';
let pfDb = null;
let pfPedidos = [];
let pfUnsub = null;
let pfBuscaTermo = '';

/* ---------- Utilitários ---------- */
function pfMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pfEscapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function pfParseValor(txt) {
  let s = String(txt || '').replace(/[R$\s]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function pfCalcularTotalEntrada() {
  const inCusto = document.getElementById('in-pedidos-custo');
  const inQtd = document.getElementById('in-pedidos-qtd');
  const inTotal = document.getElementById('in-pedidos-total');
  if (!inCusto || !inQtd || !inTotal) return;

  const custo = pfParseValor(inCusto.value);
  const qtd = parseFloat(inQtd.value) || 0;
  const total = custo * qtd;
  inTotal.value = total > 0 ? pfMoeda(total) : '';
}

/* ---------- CRUD Firestore ---------- */
function pfCarregarPedidos() {
  if (pfUnsub) pfUnsub();
  const corpo = document.getElementById('linhas-pedidos');

  pfUnsub = pfDb.collection(PF_COLECAO).onSnapshot(snap => {
    const lista = [];
    snap.forEach(doc => {
      lista.push(Object.assign({ id: doc.id }, doc.data()));
    });

    lista.sort((a, b) => {
      const ta = a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : 0;
      const tb = b.criadoEm && b.criadoEm.toMillis ? b.criadoEm.toMillis() : 0;
      return tb - ta;
    });

    pfPedidos = lista;
    pfRenderTabela();
  }, err => {
    console.error('Erro ao ler pedidos_fornecedores:', err);
    if (corpo) {
      corpo.innerHTML = `<tr class="vs-vazio"><td colspan="7" style="color:#c62828;">Erro ao carregar dados: ${err.message}</td></tr>`;
    }
  });
}

function pfObterListaVisivel() {
  const termo = pfBuscaTermo.trim().toLowerCase();
  if (!termo) return pfPedidos;
  return pfPedidos.filter(p => {
    const texto = `${p.codigo || ''} ${p.peca || ''} ${p.fornecedor || ''} ${p.custo || ''} ${p.total || ''}`.toLowerCase();
    return texto.includes(termo);
  });
}

function pfRenderTabela() {
  const corpo = document.getElementById('linhas-pedidos');
  if (!corpo) return;

  const lista = pfObterListaVisivel();
  if (!lista.length) {
    const msg = pfBuscaTermo ? `Nenhum pedido encontrado para "${pfEscapar(pfBuscaTermo)}".` : 'Nenhum pedido cadastrado.';
    corpo.innerHTML = `<tr class="vs-vazio"><td colspan="7">${msg}</td></tr>`;
  } else {
    corpo.innerHTML = lista.map(p => `
      <tr>
        <td style="text-align:center;">${pfEscapar(p.codigo || '—')}</td>
        <td style="text-align:left;">${pfEscapar(p.peca || '')}</td>
        <td style="text-align:left;">${pfEscapar(p.fornecedor || '—')}</td>
        <td style="text-align:right;">${pfMoeda(p.custo)}</td>
        <td style="text-align:center;">${pfEscapar(p.qtd || 1)}</td>
        <td style="text-align:right; font-weight:bold;">${pfMoeda(p.total)}</td>
        <td style="text-align:center;" class="c-acoes">
          <button type="button" class="vs-btn-editar" onclick="pfEditar('${p.id}')" title="Editar pedido">✏️</button>
          <button type="button" class="vs-btn-excluir" onclick="pfExcluir('${p.id}')" title="Excluir pedido">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  const totalGeral = lista.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const elTotal = document.getElementById('total-pedidos');
  const elRotulo = document.getElementById('total-rotulo-pedidos');
  if (elTotal) elTotal.textContent = pfMoeda(totalGeral);
  if (elRotulo) {
    elRotulo.textContent = pfBuscaTermo ? `TOTAL ENCONTRADO (${lista.length})` : 'TOTAL DOS PEDIDOS';
  }
}

function pfAdicionar() {
  const inCod = document.getElementById('in-pedidos-codigo');
  const inPeca = document.getElementById('in-pedidos-desc');
  const inForn = document.getElementById('in-pedidos-fornecedor');
  const inCusto = document.getElementById('in-pedidos-custo');
  const inQtd = document.getElementById('in-pedidos-qtd');

  const codigo = inCod.value.trim().toUpperCase();
  const peca = inPeca.value.trim().toUpperCase();
  const fornecedor = inForn.value.trim().toUpperCase();
  const custo = pfParseValor(inCusto.value);
  const qtd = parseInt(inQtd.value, 10) || 1;

  if (!peca) {
    inPeca.focus();
    Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Informe o nome da peça.', timer: 2500, showConfirmButton: false });
    return;
  }
  if (custo <= 0) {
    inCusto.focus();
    Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Informe o preço de custo.', timer: 2500, showConfirmButton: false });
    return;
  }

  const total = Math.round(custo * qtd * 100) / 100;
  const usuario = (typeof vsUsuario !== 'undefined' && vsUsuario) ? vsUsuario.email : '';

  pfDb.collection(PF_COLECAO).add({
    codigo: codigo,
    peca: peca,
    fornecedor: fornecedor,
    custo: custo,
    qtd: qtd,
    total: total,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    criadoPor: usuario
  }).then(() => {
    inCod.value = '';
    inPeca.value = '';
    inForn.value = '';
    inCusto.value = '';
    inQtd.value = '1';
    document.getElementById('in-pedidos-total').value = '';
    inCod.focus();
  }).catch(err => {
    console.error(err);
    Swal.fire('Erro', 'Não foi possível salvar o pedido: ' + err.message, 'error');
  });
}

function pfEditar(id) {
  const p = pfPedidos.find(item => item.id === id);
  if (!p) return;

  Swal.fire({
    title: 'Editar Pedido a Fornecedor',
    html: `
      <div style="text-align:left; font-size:13px; display:flex; flex-direction:column; gap:8px;">
        <label><b>CÓDIGO:</b></label>
        <input id="swal-ped-codigo" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${pfEscapar(p.codigo || '')}">
        <label><b>NOME DA PEÇA:</b></label>
        <input id="swal-ped-peca" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${pfEscapar(p.peca || '')}">
        <label><b>FORNECEDOR:</b></label>
        <input id="swal-ped-forn" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${pfEscapar(p.fornecedor || '')}">
        <div style="display:flex; gap:10px;">
          <div style="flex:1;">
            <label><b>PREÇO DE CUSTO:</b></label>
            <input id="swal-ped-custo" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${p.custo != null ? Number(p.custo).toFixed(2).replace('.', ',') : ''}">
          </div>
          <div style="width:100px;">
            <label><b>QTD:</b></label>
            <input id="swal-ped-qtd" type="number" min="1" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${p.qtd || 1}">
          </div>
        </div>
        <label><b>VALOR TOTAL:</b></label>
        <input id="swal-ped-total" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box; background:#eee;" readonly value="${pfMoeda(p.total)}">
      </div>
    `,
    didOpen: () => {
      const inC = document.getElementById('swal-ped-custo');
      const inQ = document.getElementById('swal-ped-qtd');
      const inT = document.getElementById('swal-ped-total');
      const atualizar = () => {
        const c = pfParseValor(inC.value);
        const q = parseFloat(inQ.value) || 0;
        inT.value = pfMoeda(c * q);
      };
      inC.addEventListener('input', atualizar);
      inQ.addEventListener('input', atualizar);
    },
    showCancelButton: true,
    confirmButtonText: '💾 Salvar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2e7d32',
    preConfirm: () => {
      const codigo = document.getElementById('swal-ped-codigo').value.trim().toUpperCase();
      const peca = document.getElementById('swal-ped-peca').value.trim().toUpperCase();
      const fornecedor = document.getElementById('swal-ped-forn').value.trim().toUpperCase();
      const custo = pfParseValor(document.getElementById('swal-ped-custo').value);
      const qtd = parseInt(document.getElementById('swal-ped-qtd').value, 10) || 1;

      if (!peca) {
        Swal.showValidationMessage('Informe o nome da peça');
        return false;
      }
      if (custo <= 0) {
        Swal.showValidationMessage('Informe o preço de custo');
        return false;
      }

      return {
        codigo: codigo,
        peca: peca,
        fornecedor: fornecedor,
        custo: custo,
        qtd: qtd,
        total: Math.round(custo * qtd * 100) / 100,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
    }
  }).then(r => {
    if (r.isConfirmed && r.value) {
      pfDb.collection(PF_COLECAO).doc(id).update(r.value).then(() => {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pedido atualizado!', timer: 2000, showConfirmButton: false });
      }).catch(err => Swal.fire('Erro', err.message, 'error'));
    }
  });
}

function pfExcluir(id) {
  const p = pfPedidos.find(item => item.id === id);
  Swal.fire({
    title: 'Excluir este pedido?',
    text: p ? `${p.peca} (${pfMoeda(p.total)})` : '',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#c62828',
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  }).then(r => {
    if (r.isConfirmed) {
      pfDb.collection(PF_COLECAO).doc(id).delete().then(() => {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pedido excluído!', timer: 2000, showConfirmButton: false });
      }).catch(err => Swal.fire('Erro', err.message, 'error'));
    }
  });
}

/* ---------- Exportações ---------- */
function pfExportarPdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    Swal.fire('Erro', 'Biblioteca jsPDF não carregada.', 'error');
    return;
  }
  const lista = pfObterListaVisivel();
  if (!lista.length) {
    Swal.fire('Aviso', 'Nenhum pedido para exportar.', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  doc.setFontSize(15);
  doc.setTextColor(13, 71, 161);
  doc.text('PEDIDOS A FORNECEDORES - PARANÁ PEÇAS', 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')} | Total: ${lista.length} item(ns)`, 14, 21);

  const linhas = lista.map(p => [
    p.codigo || '—',
    p.peca || '',
    p.fornecedor || '—',
    pfMoeda(p.custo),
    p.qtd || 1,
    pfMoeda(p.total)
  ]);

  const totalGeral = lista.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const totalQtd = lista.reduce((acc, p) => acc + (Number(p.qtd) || 0), 0);

  doc.autoTable({
    startY: 26,
    head: [['CÓDIGO', 'NOME DA PEÇA', 'FORNECEDOR', 'PREÇO CUSTO', 'QTD', 'VALOR TOTAL']],
    body: linhas,
    foot: [['TOTAL GERAL', '', '', '', totalQtd, pfMoeda(totalGeral)]],
    theme: 'grid',
    headStyles: { fillColor: [13, 71, 161], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [238, 238, 238], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 },
      1: { halign: 'left' },
      2: { halign: 'left' },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 34 }
    },
    styles: { fontSize: 9, cellPadding: 2 }
  });

  doc.save(`pedidos-fornecedores-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function pfExportarExcel() {
  if (!window.XLSX) {
    Swal.fire('Erro', 'Biblioteca XLSX não carregada.', 'error');
    return;
  }
  const lista = pfObterListaVisivel();
  if (!lista.length) {
    Swal.fire('Aviso', 'Nenhum pedido para exportar.', 'warning');
    return;
  }

  const dados = lista.map(p => ({
    'CÓDIGO': p.codigo || '',
    'NOME DA PEÇA': p.peca || '',
    'FORNECEDOR': p.fornecedor || '',
    'PREÇO DE CUSTO (R$)': Number(p.custo) || 0,
    'QUANTIDADE': Number(p.qtd) || 1,
    'VALOR TOTAL (R$)': Number(p.total) || 0
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos Fornecedores');
  XLSX.writeFile(wb, `pedidos-fornecedores-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function pfSalvarPrint() {
  if (typeof html2canvas === 'undefined') {
    Swal.fire('Erro', 'Biblioteca html2canvas não foi carregada no head.', 'error');
    return;
  }
  const alvo = document.getElementById('card-pedidos') || document.getElementById('tabela-pedidos');
  if (!alvo) return;

  Swal.fire({
    title: 'Gerando print...',
    text: 'Aguarde um momento.',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const canvas = await html2canvas(alvo, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      ignoreElements: el => el.classList && (el.classList.contains('vs-entrada') || el.classList.contains('c-acoes'))
    });
    const link = document.createElement('a');
    link.download = `pedidos-fornecedores-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    Swal.close();
  } catch (err) {
    console.error(err);
    Swal.fire('Erro', 'Não foi possível gerar a imagem: ' + err.message, 'error');
  }
}

/* ---------- Inicialização ---------- */
function pfIniciar() {
  const cfg = window.PARANA_FIREBASE_CONFIG || window.FIREBASE_CONFIG;
  if (!firebase.apps.length && cfg) firebase.initializeApp(cfg);
  pfDb = (typeof vsDb !== 'undefined' && vsDb) ? vsDb : firebase.firestore();

  const inCusto = document.getElementById('in-pedidos-custo');
  const inQtd = document.getElementById('in-pedidos-qtd');
  if (inCusto && inQtd) {
    inCusto.addEventListener('input', pfCalcularTotalEntrada);
    inQtd.addEventListener('input', pfCalcularTotalEntrada);
  }

  const campos = ['codigo', 'desc', 'fornecedor', 'custo', 'qtd'];
  campos.forEach((nome, i) => {
    const el = document.getElementById(`in-pedidos-${nome}`);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i === campos.length - 1) {
        pfAdicionar();
      } else {
        const proximo = document.getElementById(`in-pedidos-${campos[i + 1]}`);
        if (proximo) {
          proximo.focus();
          if (proximo.select) proximo.select();
        }
      }
    });
  });

  const busca = document.getElementById('busca-pedidos');
  if (busca) {
    busca.addEventListener('input', e => {
      pfBuscaTermo = e.target.value;
      pfRenderTabela();
    });
  }

  pfCarregarPedidos();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pfIniciar);
} else {
  pfIniciar();
}
