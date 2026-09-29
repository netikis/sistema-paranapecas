'use strict';
/* Parana Pecas — modulo Pedido de Pecas (pedidos.html) */

const PD_DOC = ['config', 'pedidos_pecas'];

let pdDb = null;
let pdAuth = null;
let pdUsuario = null;
let pdAppAberto = false;
let pdPedidos = [];
let pdEditandoId = null;
let pdBusca = '';
let pdFiltro = 'todos';
let pdUnsub = null;

function pdMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pdEscapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pdParseValor(txt) {
  let s = String(txt || '').replace(/[R$\s]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function pdDigitos(t) { return String(t || '').replace(/\D/g, ''); }

function pdFmtTel(t) {
  const d = pdDigitos(t).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}

function pdDataBr(iso) {
  const p = String(iso || '').split('-');
  if (p.length !== 3) return iso || '';
  return p[2] + '/' + p[1] + '/' + p[0];
}

function pdHojeIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function pdNovoId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function pdNormalizar(t) {
  return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function pdAviso(msg) {
  Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: msg, timer: 2500, showConfirmButton: false });
}

function pdErro(err) {
  console.error(err);
  const semPermissao = err && err.code === 'permission-denied';
  Swal.fire('Erro', semPermissao
    ? 'Sem permissão para gravar os pedidos. Publique as regras do Firestore no Console do Firebase.'
    : 'Não foi possível salvar: ' + (err && err.message ? err.message : err), 'error');
}

function pdDocRef() {
  return pdDb.collection(PD_DOC[0]).doc(PD_DOC[1]);
}

function pdCampo(id) { return document.getElementById(id); }

function pdLimparFormulario() {
  pdEditandoId = null;
  pdCampo('pdFormTitulo').textContent = 'Novo pedido';
  pdCampo('pdBtnSalvar').textContent = '➕ Salvar';
  pdCampo('pdBtnCancelar').hidden = true;
  pdCampo('pdTelefone').value = '';
  pdCampo('pdCliente').value = '';
  pdCampo('pdPeca').value = '';
  pdCampo('pdValor').value = '';
  pdCampo('pdData').value = pdHojeIso();
  pdCampo('pdForm').classList.remove('pd-editando');
}

function pdPreencherFormulario(p) {
  pdEditandoId = p.id;
  pdCampo('pdFormTitulo').textContent = 'Editar pedido';
  pdCampo('pdBtnSalvar').textContent = '💾 Atualizar';
  pdCampo('pdBtnCancelar').hidden = false;
  pdCampo('pdTelefone').value = pdFmtTel(p.telefone);
  pdCampo('pdCliente').value = p.cliente || '';
  pdCampo('pdPeca').value = p.peca || '';
  pdCampo('pdValor').value = Number(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  pdCampo('pdData').value = p.data || pdHojeIso();
  pdCampo('pdForm').classList.add('pd-editando');
  pdCampo('pdCliente').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pdLerFormulario() {
  const telefone = pdDigitos(pdCampo('pdTelefone').value);
  const cliente = pdCampo('pdCliente').value.trim();
  const peca = pdCampo('pdPeca').value.trim();
  const valor = pdParseValor(pdCampo('pdValor').value);
  const data = pdCampo('pdData').value;

  if (telefone.length < 10) {
    pdCampo('pdTelefone').focus();
    pdAviso('Informe o telefone com DDD.');
    return null;
  }
  if (!cliente) {
    pdCampo('pdCliente').focus();
    return null;
  }
  if (!peca) {
    pdCampo('pdPeca').focus();
    return null;
  }
  if (!data) {
    pdCampo('pdData').focus();
    pdAviso('Informe o dia da encomenda.');
    return null;
  }
  return {
    telefone: telefone,
    cliente: cliente.toUpperCase(),
    peca: peca.toUpperCase(),
    valor: valor,
    data: data
  };
}

function pdMesAtual(iso) {
  const hoje = pdHojeIso();
  return String(iso || '').slice(0, 7) === hoje.slice(0, 7);
}

function pdListaVisivel() {
  const termo = pdNormalizar(pdBusca.trim());
  return pdPedidos.filter(p => {
    if (pdFiltro === 'mes' && !pdMesAtual(p.data)) return false;
    if (!termo) return true;
    return pdNormalizar(`${p.cliente} ${p.peca} ${p.telefone} ${pdFmtTel(p.telefone)} ${pdMoeda(p.valor)} ${pdDataBr(p.data)}`).includes(termo);
  });
}

function pdWaLink(p) {
  const tel = pdDigitos(p.telefone);
  if (tel.length < 10) return '';
  const num = tel.length === 11 || tel.length === 10 ? '55' + tel : tel;
  const texto = encodeURIComponent('Olá ' + p.cliente + ', sobre o pedido da peça ' + p.peca + '.');
  return 'https://wa.me/' + num + '?text=' + texto;
}

function pdRender() {
  const lista = pdListaVisivel();
  const corpo = pdCampo('pdLinhas');
  if (!lista.length) {
    const msg = pdBusca.trim()
      ? 'Nenhum pedido encontrado.'
      : (pdFiltro === 'mes' ? 'Nenhum pedido neste mês.' : 'Nenhum pedido cadastrado.');
    corpo.innerHTML = `<tr class="pd-vazio"><td colspan="6">${msg}</td></tr>`;
  } else {
    corpo.innerHTML = lista.map(p => {
      const wa = pdWaLink(p);
      return `<tr>
        <td class="c-data">${pdEscapar(pdDataBr(p.data))}</td>
        <td class="c-cliente">${pdEscapar(p.cliente)}</td>
        <td class="c-tel"><a class="pd-tel-link" href="tel:+55${pdEscapar(p.telefone)}">${pdEscapar(pdFmtTel(p.telefone))}</a></td>
        <td class="c-peca">${pdEscapar(p.peca)}</td>
        <td class="c-valor">${pdMoeda(p.valor)}</td>
        <td class="c-acoes">
          ${wa ? `<a href="${wa}" target="_blank" rel="noopener" class="pd-btn-wapp" style="display:inline-block;text-decoration:none;" title="WhatsApp">💬</a>` : ''}
          <button type="button" class="pd-btn-editar" onclick="pdEditar('${p.id}')" title="Editar">✏️</button>
          <button type="button" class="pd-btn-excluir" onclick="pdExcluir('${p.id}')" title="Excluir">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  const total = lista.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  pdCampo('pdTotal').textContent = pdMoeda(total);
  pdCampo('pdTotalRotulo').textContent = pdBusca.trim()
    ? `TOTAL ENCONTRADO (${lista.length})`
    : (pdFiltro === 'mes' ? `TOTAL DO MÊS (${lista.length})` : `TOTAL (${lista.length})`);
}

function pdOrdenar(a, b) {
  if (a.data !== b.data) return a.data < b.data ? 1 : -1;
  return (b.ordem || 0) - (a.ordem || 0);
}

function pdOuvir() {
  if (pdUnsub) pdUnsub();
  pdUnsub = pdDocRef().onSnapshot(doc => {
    const dados = doc.exists ? (doc.data() || {}) : {};
    const lista = [];
    Object.keys(dados).forEach(id => {
      if (id[0] === '_') return;
      const item = dados[id];
      if (!item || typeof item !== 'object') return;
      lista.push(Object.assign({ id: id }, item));
    });
    pdPedidos = lista.sort(pdOrdenar);
    pdRender();
  }, pdErro);
}

function pdSalvar(ev) {
  if (ev) ev.preventDefault();
  const dados = pdLerFormulario();
  if (!dados) return;

  const id = pdEditandoId || pdNovoId();
  const payload = Object.assign({}, dados, {
    ordem: Date.now(),
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: pdUsuario ? (pdUsuario.email || '') : ''
  });
  if (!pdEditandoId) {
    payload.criadoEm = payload.atualizadoEm;
    payload.criadoPor = payload.atualizadoPor;
  }

  pdDocRef().set({ [id]: payload }, { merge: true }).then(() => {
    pdLimparFormulario();
    pdCampo('pdTelefone').focus();
  }).catch(pdErro);
}

function pdEditar(id) {
  const p = pdPedidos.find(x => x.id === id);
  if (p) pdPreencherFormulario(p);
}

function pdExcluir(id) {
  Swal.fire({
    title: 'Excluir este pedido?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar'
  }).then(r => {
    if (!r.isConfirmed) return;
    pdDocRef().update({ [id]: firebase.firestore.FieldValue.delete() }).catch(pdErro);
  });
}

function pdAbrirApp() {
  if (pdAppAberto) return;
  pdAppAberto = true;
  pdCampo('pdCarregando').hidden = true;
  pdCampo('pdApp').hidden = false;
  pdLimparFormulario();

  pdCampo('pdTelefone').addEventListener('input', () => {
    const el = pdCampo('pdTelefone');
    el.value = pdFmtTel(el.value);
  });
  pdCampo('pdForm').addEventListener('submit', pdSalvar);
  pdCampo('pdBtnCancelar').addEventListener('click', pdLimparFormulario);
  pdCampo('pdBusca').addEventListener('input', e => {
    pdBusca = e.target.value;
    pdRender();
  });
  pdCampo('pdFiltro').addEventListener('change', e => {
    pdFiltro = e.target.value;
    pdRender();
  });
  pdOuvir();
  pdCampo('pdTelefone').focus();
}

function pdIniciar() {
  const cfg = window.PARANA_FIREBASE_CONFIG || window.FIREBASE_CONFIG;
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  pdDb = firebase.firestore();
  pdAuth = firebase.auth();

  pdAuth.onAuthStateChanged(user => {
    if (!user) {
      window.location.replace('index.html');
      return;
    }
    try { sessionStorage.setItem('pp_sessao', '1'); } catch (e) {}
    pdUsuario = user;
    pdDb.collection('usuarios').doc(user.uid).get().then(doc => {
      const nome = doc.exists ? doc.data().nome : user.email;
      pdCampo('pdUsuario').textContent = '👤 ' + (nome || user.email);
      pdAbrirApp();
    }).catch(() => {
      pdCampo('pdUsuario').textContent = '👤 ' + (user.email || '');
      pdAbrirApp();
    });
  });
}

pdIniciar();
