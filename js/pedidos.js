'use strict';
/* Parana Pecas — modulo Pedido de Pecas (pedidos.html) */

const PD_DOC = ['config', 'pedidos_pecas'];
const PD_MAX_FOTOS = 6;

let pdDb = null;
let pdAuth = null;
let pdUsuario = null;
let pdAppAberto = false;
let pdPedidos = [];
let pdEditandoId = null;
let pdBusca = '';
let pdFiltro = 'todos';
let pdUnsub = null;
let pdImagens = [];
let pdRecortandoIndex = -1;
let pdCropUrlTemporaria = '';
let pdCropBox = { x: 0, y: 0, w: 0, h: 0 };
let pdCropDrag = null;
let pdFotosModalId = '';

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

function pdOk(msg) {
  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: msg, timer: 1800, showConfirmButton: false });
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

function pdImagemItemRef(id, i) {
  return pdDb.collection('config').doc('pedido_img_' + id + '_' + i);
}

function pdSalvarImagens(id, imagens) {
  const ops = [];
  for (let i = 0; i < PD_MAX_FOTOS; i++) {
    const ref = pdImagemItemRef(id, i);
    if (imagens[i]) ops.push(ref.set({ src: imagens[i], n: i }));
    else ops.push(ref.delete().catch(() => {}));
  }
  return Promise.all(ops);
}

function pdCarregarImagens(id) {
  const ops = [];
  for (let i = 0; i < PD_MAX_FOTOS; i++) ops.push(pdImagemItemRef(id, i).get());
  return Promise.all(ops).then(docs => docs
    .filter(d => d.exists && d.data() && d.data().src)
    .sort((a, b) => (a.data().n || 0) - (b.data().n || 0))
    .map(d => d.data().src));
}

function pdApagarImagens(id) {
  const ops = [];
  for (let i = 0; i < PD_MAX_FOTOS; i++) ops.push(pdImagemItemRef(id, i).delete().catch(() => {}));
  return Promise.all(ops);
}

function pdCampo(id) { return document.getElementById(id); }

function pdLimparFormulario() {
  pdEditandoId = null;
  pdImagens = [];
  pdCampo('pdFormTitulo').textContent = 'Novo pedido';
  pdCampo('pdBtnSalvar').textContent = '➕ Salvar';
  pdCampo('pdBtnCancelar').hidden = true;
  pdCampo('pdTelefone').value = '';
  pdCampo('pdCliente').value = '';
  pdCampo('pdPeca').value = '';
  pdCampo('pdValor').value = '';
  pdCampo('pdData').value = pdHojeIso();
  pdCampo('pdForm').classList.remove('pd-editando');
  pdRenderGaleria();
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

function pdCelulaFoto(p) {
  const qtd = Number(p.fotos || 0);
  if (!qtd && !p.miniatura) return '<span class="pd-sem-foto">—</span>';
  if (p.miniatura) {
    return `<img class="pd-thumb" src="${p.miniatura}" alt="Foto do pedido" onclick="pdVerFotos('${p.id}')" title="Ver fotos">`;
  }
  return `<button type="button" class="pd-btn-arquivo" onclick="pdVerFotos('${p.id}')">📷 ${qtd}</button>`;
}

function pdRender() {
  const lista = pdListaVisivel();
  const corpo = pdCampo('pdLinhas');
  if (!lista.length) {
    const msg = pdBusca.trim()
      ? 'Nenhum pedido encontrado.'
      : (pdFiltro === 'mes' ? 'Nenhum pedido neste mês.' : 'Nenhum pedido cadastrado.');
    corpo.innerHTML = `<tr class="pd-vazio"><td colspan="7">${msg}</td></tr>`;
  } else {
    corpo.innerHTML = lista.map(p => {
      const wa = pdWaLink(p);
      return `<tr>
        <td class="c-data">${pdEscapar(pdDataBr(p.data))}</td>
        <td class="c-cliente">${pdEscapar(p.cliente)}</td>
        <td class="c-tel"><a class="pd-tel-link" href="tel:+55${pdEscapar(p.telefone)}">${pdEscapar(pdFmtTel(p.telefone))}</a></td>
        <td class="c-peca">${pdEscapar(p.peca)}</td>
        <td class="c-foto">${pdCelulaFoto(p)}</td>
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

function pdMiniaturaDeSrc(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const max = 160;
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * r));
      c.height = Math.max(1, Math.round(img.height * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.55));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

function pdSalvar(ev) {
  if (ev) ev.preventDefault();
  const dados = pdLerFormulario();
  if (!dados) return;

  const id = pdEditandoId || pdNovoId();
  const imagens = pdImagens.map(im => im.src).filter(Boolean);
  const btn = pdCampo('pdBtnSalvar');
  btn.disabled = true;

  const finalizar = payload => {
    pdDocRef().set({ [id]: payload }, { merge: true }).then(() => {
      return imagens.length ? pdSalvarImagens(id, imagens) : pdApagarImagens(id);
    }).then(() => {
      pdLimparFormulario();
      pdCampo('pdTelefone').focus();
      pdOk('Pedido salvo.');
    }).catch(pdErro).finally(() => { btn.disabled = false; });
  };

  const payload = Object.assign({}, dados, {
    ordem: Date.now(),
    fotos: imagens.length,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: pdUsuario ? (pdUsuario.email || '') : ''
  });
  if (!pdEditandoId) {
    payload.criadoEm = payload.atualizadoEm;
    payload.criadoPor = payload.atualizadoPor;
  }

  if (!imagens.length) {
    payload.miniatura = firebase.firestore.FieldValue.delete();
    finalizar(payload);
    return;
  }

  pdMiniaturaDeSrc(imagens[0]).then(mini => {
    payload.miniatura = mini || firebase.firestore.FieldValue.delete();
    finalizar(payload);
  });
}

function pdEditar(id) {
  const p = pdPedidos.find(x => x.id === id);
  if (!p) return;
  pdPreencherFormulario(p);
  pdImagens = [];
  pdRenderGaleria();
  pdCarregarImagens(id).then(lista => {
    if (pdEditandoId !== id) return;
    pdImagens = lista.filter(Boolean).map(src => ({ src: src }));
    pdRenderGaleria();
  }).catch(pdErro);
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
    pdDocRef().update({ [id]: firebase.firestore.FieldValue.delete() })
      .then(() => pdApagarImagens(id))
      .catch(pdErro);
  });
}

function pdStatusImagens(texto) {
  const el = pdCampo('pdStatusImagens');
  if (!el) return;
  el.textContent = texto || '';
  clearTimeout(pdStatusImagens._timer);
  if (texto) {
    pdStatusImagens._timer = setTimeout(() => { el.textContent = ''; }, 4000);
  }
}

function pdRenderGaleria() {
  const galeria = pdCampo('pdGaleria');
  if (!galeria) return;
  if (!pdImagens.length) {
    galeria.innerHTML = '';
    return;
  }
  galeria.innerHTML = pdImagens.map((im, index) => `
    <div class="pd-card-img">
      <img src="${im.src}" alt="Foto ${index + 1} do pedido">
      <div class="pd-card-acoes">
        <button type="button" class="pd-btn-editar" onclick="pdRecortarExistente(${index})">Recortar</button>
        <button type="button" class="pd-btn-excluir" onclick="pdRemoverImagem(${index})">Remover</button>
      </div>
    </div>`).join('');
}

function pdExtrairImagemClipboard(clipboardData) {
  if (!clipboardData) return null;
  const itens = clipboardData.items || [];
  for (let i = 0; i < itens.length; i++) {
    if (itens[i].type && itens[i].type.indexOf('image') === 0) return itens[i].getAsFile();
  }
  const arquivos = clipboardData.files || [];
  for (let i = 0; i < arquivos.length; i++) {
    if (arquivos[i].type && arquivos[i].type.indexOf('image') === 0) return arquivos[i];
  }
  return null;
}

async function pdColarPrint() {
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const itens = await navigator.clipboard.read();
      for (const item of itens) {
        const tipo = item.types.find(t => t.indexOf('image') === 0);
        if (tipo) {
          const blob = await item.getType(tipo);
          pdAbrirRecorteDeArquivo(blob);
          pdStatusImagens('Print colado. Recorte se quiser e clique em Salvar no pedido.');
          return;
        }
      }
    } catch (e) { /* Ctrl+V */ }
  }
  alert('Não foi possível ler a área de transferência automaticamente.\n\n1) Pressione Print Screen (ou Win + Shift + S)\n2) Clique nesta tela\n3) Pressione Ctrl + V para colar o print.');
}

function pdAbrirRecorteDeArquivo(arquivo, indice) {
  if (pdRecortandoIndex < 0 && pdImagens.length >= PD_MAX_FOTOS) {
    return pdAviso('Máximo de ' + PD_MAX_FOTOS + ' fotos por pedido.');
  }
  pdRecortandoIndex = typeof indice === 'number' ? indice : -1;
  pdLimparUrlTemporaria();
  pdCropUrlTemporaria = URL.createObjectURL(arquivo);
  pdCarregarImagemRecorte(pdCropUrlTemporaria, true);
}

function pdRecortarExistente(index) {
  const imagem = pdImagens[index];
  if (!imagem || !imagem.src) return;
  pdRecortandoIndex = index;
  pdLimparUrlTemporaria();
  pdCarregarImagemRecorte(imagem.src, false);
}

function pdCarregarImagemRecorte(src, revogarUrl) {
  const img = pdCampo('pdCropImg');
  const modal = pdCampo('pdModalRecorte');
  img.onload = () => {
    if (revogarUrl) pdLimparUrlTemporaria();
    modal.classList.add('aberto');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => pdAjustarCrop(false));
  };
  img.onerror = () => {
    if (revogarUrl) pdLimparUrlTemporaria();
    alert('Não foi possível abrir a imagem. Tente colar novamente ou escolher outro arquivo.');
  };
  img.src = src;
}

function pdLimparUrlTemporaria() {
  if (pdCropUrlTemporaria) {
    URL.revokeObjectURL(pdCropUrlTemporaria);
    pdCropUrlTemporaria = '';
  }
}

function pdFecharRecorte() {
  const modal = pdCampo('pdModalRecorte');
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.removeProperty('overflow');
  pdRecortandoIndex = -1;
  pdCropDrag = null;
  pdLimparUrlTemporaria();
}

function pdAplicarBoxCrop() {
  const box = pdCampo('pdCropBox');
  box.style.left = pdCropBox.x + 'px';
  box.style.top = pdCropBox.y + 'px';
  box.style.width = pdCropBox.w + 'px';
  box.style.height = pdCropBox.h + 'px';
}

function pdTamanhoImagemCrop() {
  const img = pdCampo('pdCropImg');
  return { w: img.clientWidth || 0, h: img.clientHeight || 0 };
}

function pdLimitarCropBox(box) {
  const tam = pdTamanhoImagemCrop();
  const min = 24;
  const limitado = { x: box.x, y: box.y, w: box.w, h: box.h };

  if (limitado.w < min) {
    if (pdCropDrag && String(pdCropDrag.handle).indexOf('w') !== -1) {
      limitado.x = pdCropDrag.startBox.x + pdCropDrag.startBox.w - min;
    }
    limitado.w = min;
  }
  if (limitado.h < min) {
    if (pdCropDrag && String(pdCropDrag.handle).indexOf('n') !== -1) {
      limitado.y = pdCropDrag.startBox.y + pdCropDrag.startBox.h - min;
    }
    limitado.h = min;
  }
  if (limitado.x < 0) {
    if (pdCropDrag && pdCropDrag.handle !== 'move') limitado.w += limitado.x;
    limitado.x = 0;
  }
  if (limitado.y < 0) {
    if (pdCropDrag && pdCropDrag.handle !== 'move') limitado.h += limitado.y;
    limitado.y = 0;
  }
  if (limitado.x + limitado.w > tam.w) {
    if (pdCropDrag && pdCropDrag.handle === 'move') limitado.x = tam.w - limitado.w;
    else limitado.w = tam.w - limitado.x;
  }
  if (limitado.y + limitado.h > tam.h) {
    if (pdCropDrag && pdCropDrag.handle === 'move') limitado.y = tam.h - limitado.h;
    else limitado.h = tam.h - limitado.y;
  }

  limitado.w = Math.max(min, Math.min(limitado.w, tam.w));
  limitado.h = Math.max(min, Math.min(limitado.h, tam.h));
  limitado.x = Math.max(0, Math.min(limitado.x, tam.w - limitado.w));
  limitado.y = Math.max(0, Math.min(limitado.y, tam.h - limitado.h));
  return limitado;
}

function pdAjustarCrop(manterProporcao) {
  const tam = pdTamanhoImagemCrop();
  if (!tam.w || !tam.h) return;
  if (!manterProporcao || !pdCropBox.w || !pdCropBox.h) {
    pdCropBox = { x: 0, y: 0, w: tam.w, h: tam.h };
  } else {
    pdCropBox = pdLimitarCropBox(pdCropBox);
  }
  pdAplicarBoxCrop();
}

function pdUsarImagemInteira() {
  const tam = pdTamanhoImagemCrop();
  pdCropBox = { x: 0, y: 0, w: tam.w, h: tam.h };
  pdAplicarBoxCrop();
}

function pdIniciarArrasteCrop(evento) {
  const handleEl = evento.target.closest('.pd-crop-handle');
  const naCaixa = evento.target.closest('.pd-crop-box');
  if (!handleEl && !naCaixa) return;
  evento.preventDefault();
  pdCropDrag = {
    handle: handleEl ? handleEl.getAttribute('data-handle') : 'move',
    startX: evento.clientX,
    startY: evento.clientY,
    startBox: { x: pdCropBox.x, y: pdCropBox.y, w: pdCropBox.w, h: pdCropBox.h }
  };
}

function pdMoverArrasteCrop(evento) {
  if (!pdCropDrag) return;
  const dx = evento.clientX - pdCropDrag.startX;
  const dy = evento.clientY - pdCropDrag.startY;
  const s = pdCropDrag.startBox;
  const h = pdCropDrag.handle;
  const novo = { x: s.x, y: s.y, w: s.w, h: s.h };

  if (h === 'move') {
    novo.x = s.x + dx;
    novo.y = s.y + dy;
  } else {
    if (h.indexOf('e') !== -1) novo.w = s.w + dx;
    if (h.indexOf('s') !== -1) novo.h = s.h + dy;
    if (h.indexOf('w') !== -1) {
      novo.x = s.x + dx;
      novo.w = s.w - dx;
    }
    if (h.indexOf('n') !== -1) {
      novo.y = s.y + dy;
      novo.h = s.h - dy;
    }
  }
  pdCropBox = pdLimitarCropBox(novo);
  pdAplicarBoxCrop();
}

function pdFinalizarArrasteCrop() { pdCropDrag = null; }

function pdGerarCanvasRecorte(maxLado) {
  const img = pdCampo('pdCropImg');
  if (!img.naturalWidth) throw new Error('Imagem não carregada.');
  const escalaX = img.naturalWidth / img.clientWidth;
  const escalaY = img.naturalHeight / img.clientHeight;
  let sx = Math.round(pdCropBox.x * escalaX);
  let sy = Math.round(pdCropBox.y * escalaY);
  let sw = Math.round(pdCropBox.w * escalaX);
  let sh = Math.round(pdCropBox.h * escalaY);
  sx = Math.max(0, Math.min(sx, img.naturalWidth - 1));
  sy = Math.max(0, Math.min(sy, img.naturalHeight - 1));
  sw = Math.max(1, Math.min(sw, img.naturalWidth - sx));
  sh = Math.max(1, Math.min(sh, img.naturalHeight - sy));

  let outW = sw;
  let outH = sh;
  if (maxLado && Math.max(sw, sh) > maxLado) {
    const r = maxLado / Math.max(sw, sh);
    outW = Math.max(1, Math.round(sw * r));
    outH = Math.max(1, Math.round(sh * r));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas;
}

function pdCanvasParaBlob(canvas, qualidade) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível gerar a imagem recortada.'));
    }, 'image/jpeg', qualidade);
  });
}

function pdBlobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem recortada.'));
    leitor.readAsDataURL(blob);
  });
}

async function pdAplicarImagemNoPedido() {
  try {
    const canvas = pdGerarCanvasRecorte(1100);
    const blob = await pdCanvasParaBlob(canvas, 0.72);
    const src = await pdBlobParaDataUrl(blob);
    if (pdRecortandoIndex > -1 && pdImagens[pdRecortandoIndex]) {
      pdImagens[pdRecortandoIndex].src = src;
    } else {
      if (pdImagens.length >= PD_MAX_FOTOS) return pdAviso('Máximo de ' + PD_MAX_FOTOS + ' fotos por pedido.');
      pdImagens.push({ src: src });
    }
    pdRenderGaleria();
    pdFecharRecorte();
    pdStatusImagens('Imagem salva no pedido. Clique em Salvar para gravar a encomenda.');
  } catch (erro) {
    alert('Não foi possível salvar a imagem no pedido.\n\nDetalhe: ' + (erro && erro.message ? erro.message : erro));
  }
}

function pdRemoverImagem(index) {
  pdImagens.splice(index, 1);
  pdRenderGaleria();
}

function pdVerFotos(id) {
  const p = pdPedidos.find(x => x.id === id);
  pdFotosModalId = id;
  pdCampo('pdFotosTitulo').textContent = p ? ('Fotos — ' + p.cliente) : 'Fotos do pedido';
  pdCampo('pdGaleriaModal').innerHTML = '<p style="color:#555">Carregando fotos...</p>';
  pdCampo('pdModalFotos').classList.add('aberto');
  pdCampo('pdModalFotos').setAttribute('aria-hidden', 'false');
  pdCarregarImagens(id).then(lista => {
    const galeria = pdCampo('pdGaleriaModal');
    if (!lista.length) {
      galeria.innerHTML = '<p style="color:#555">Este pedido ainda não tem foto. Clique em Editar para colar o print.</p>';
      return;
    }
    galeria.innerHTML = lista.map((src, i) => `
      <div class="pd-card-img">
        <img src="${src}" alt="Foto ${i + 1}">
      </div>`).join('');
  }).catch(pdErro);
}

function pdFecharFotos() {
  pdCampo('pdModalFotos').classList.remove('aberto');
  pdCampo('pdModalFotos').setAttribute('aria-hidden', 'true');
  pdFotosModalId = '';
}

function pdIniciarImagens() {
  const arquivo = pdCampo('pdArquivoImagem');
  const stage = pdCampo('pdCropStage');
  const modal = pdCampo('pdModalRecorte');

  pdCampo('pdBtnColar').addEventListener('click', pdColarPrint);
  pdCampo('pdBtnArquivo').addEventListener('click', () => arquivo.click());
  pdCampo('pdBtnSalvarRecorte').addEventListener('click', pdAplicarImagemNoPedido);
  pdCampo('pdBtnImagemInteira').addEventListener('click', pdUsarImagemInteira);
  pdCampo('pdBtnCancelarRecorte').addEventListener('click', pdFecharRecorte);
  pdCampo('pdBtnFecharFotos').addEventListener('click', pdFecharFotos);

  arquivo.addEventListener('change', evento => {
    const file = evento.target.files && evento.target.files[0];
    evento.target.value = '';
    if (file) pdAbrirRecorteDeArquivo(file);
  });

  document.addEventListener('paste', evento => {
    const imagem = pdExtrairImagemClipboard(evento.clipboardData);
    if (!imagem) return;
    evento.preventDefault();
    pdAbrirRecorteDeArquivo(imagem);
    pdStatusImagens('Print colado. Recorte se quiser e clique em Salvar no pedido.');
  });

  document.addEventListener('keydown', evento => {
    if (evento.key !== 'Escape') return;
    if (modal.classList.contains('aberto')) pdFecharRecorte();
    else if (pdCampo('pdModalFotos').classList.contains('aberto')) pdFecharFotos();
  });

  stage.addEventListener('pointerdown', pdIniciarArrasteCrop);
  window.addEventListener('pointermove', pdMoverArrasteCrop);
  window.addEventListener('pointerup', pdFinalizarArrasteCrop);
  window.addEventListener('pointercancel', pdFinalizarArrasteCrop);
  window.addEventListener('resize', () => {
    if (modal.classList.contains('aberto')) pdAjustarCrop(true);
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
  pdIniciarImagens();
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
