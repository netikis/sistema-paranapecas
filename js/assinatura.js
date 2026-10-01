'use strict';
/* Parana Pecas — assinatura / canvas / link remoto */

  function setupCanvasEvents(canvas) {
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      let isDrawing = false; let lastX = 0; let lastY = 0;
      canvas.addEventListener('mousedown', (e) => { isDrawing = true; [lastX, lastY] = [e.offsetX, e.offsetY]; });
      canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); [lastX, lastY] = [e.offsetX, e.offsetY]; });
      canvas.addEventListener('mouseup', () => isDrawing = false); canvas.addEventListener('mouseout', () => isDrawing = false);
      canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; const r = canvas.getBoundingClientRect(); const t = e.touches[0]; lastX = t.clientX - r.left; lastY = t.clientY - r.top; }, {passive: false});
      canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (!isDrawing) return; const r = canvas.getBoundingClientRect(); const t = e.touches[0]; const x = t.clientX - r.left; const y = t.clientY - r.top; ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); lastX = x; lastY = y; }, {passive: false});
      canvas.addEventListener('touchend', () => isDrawing = false);
  }


  function abrirAssinatura(id) { 
      const checks = document.querySelectorAll(`.sel-${id}:checked`); 
      if(checks.length === 0) return Swal.fire('Atenção', "Selecione itens", 'warning'); 
      signId = id; 
      document.getElementById('assinaturaModal').style.display = 'flex'; 
      const cvs = document.getElementById('canvasAssinatura');
      cvs.width = cvs.parentElement.offsetWidth; cvs.height = 200;
      const ctx = cvs.getContext('2d'); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.clearRect(0,0,cvs.width,cvs.height);
      setupCanvasEvents(cvs); 
  }

  function capturarDigital() { document.getElementById('inputDigital').click(); }
  function colocarDigitalNoCanvas(input) {
      if (input.files && input.files[0]) {
          const reader = new FileReader();
          reader.onload = function(e) {
              const img = new Image();
              img.onload = function() {
                  const cvs = document.getElementById('canvasAssinatura');
                  const ctx = cvs.getContext('2d');
                  ctx.clearRect(0, 0, cvs.width, cvs.height);
                  const scale = Math.min(cvs.width / img.width, cvs.height / img.height);
                  const x = (cvs.width / 2) - (img.width / 2) * scale;
                  const y = (cvs.height / 2) - (img.height / 2) * scale;
                  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
              }
              img.src = e.target.result;
          }
          reader.readAsDataURL(input.files[0]);
      }
  }

  function adicionarCarimboNoCanvas() {
      let cvs = document.getElementById('canvasAssinatura');
      let ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      
      ctx.save();
      ctx.translate(cvs.width / 2, cvs.height / 2);
      
      ctx.font = "900 24px Arial";
      ctx.fillStyle = "#2e7d32";
      ctx.strokeStyle = "#2e7d32";
      ctx.lineWidth = 4;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      ctx.fillText("PAGO!", 0, -15);
      ctx.fillText("PRODUTO ENTREGUE", 0, 15);
      ctx.strokeRect(-155, -45, 310, 90);
      
      ctx.restore();
  }
  
  function salvarAssinaturaRemota() { 
      let cvs = document.getElementById('canvasRemoto'); let img = cvs.toDataURL(); 
      const urlParams = new URLSearchParams(window.location.search);
      const clienteUrlID = urlParams.get('cliente');
      const itensParams = urlParams.get('itens');
      
      db.collection("clientes").doc(clienteUrlID).get().then(doc => { 
          let itens = doc.data().itens; 
          
          if (itensParams) {
              // Aplica a assinatura APENAS nos itens passados pelo link
              let indicesAssinar = itensParams.split(',').map(Number);
              indicesAssinar.forEach(idx => {
                  if(itens[idx]) itens[idx].assinatura = img;
              });
          } else {
              // Fallback para não quebrar links antigos já enviados
              itens.forEach(i => { if(!i.pago) i.assinatura = img; }); 
          }
          
          db.collection("clientes").doc(clienteUrlID).update({ itens }).then(() => { 
              Swal.fire({ icon: 'success', title: 'Assinado!', text: 'Obrigado!', showConfirmButton: false }); 
              setTimeout(() => document.body.innerHTML = "<h2 style='text-align:center;padding:50px;color:#fff;'>Tudo certo! Pode fechar a janela.</h2>", 2000);
          }); 
      }); 
  }


  function verAssinatura(id, ii) {
      let item = clientes.find(c => c.id === id).itens[ii];
      if(!item || !item.assinatura) return;
      
      Swal.fire({
          title: 'Assinatura Registrada',
          html: `<b>Item:</b> ${item.desc}<br><b>Valor:</b> ${formatarMoeda(item.valor)}<br><b>Data:</b> ${formatarDataBR(item.data)}`,
          imageUrl: item.assinatura,
          imageWidth: 400,
          imageAlt: 'Assinatura do Cliente',
          confirmButtonText: 'Fechar'
      });
  }

  function excluirAssinatura(id, ii) {
      Swal.fire({
          title: 'Excluir esta assinatura?',
          text: 'Esta ação não pode ser desfeita!',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Sim, excluir',
          cancelButtonText: 'Cancelar'
      }).then((result) => {
          if (result.isConfirmed) {
              let c = clientes.find(x => x.id === id);
              let itens = [...c.itens];
              itens[ii].assinatura = null;
              db.collection("clientes").doc(id).update({ itens }).then(() => {
                  Swal.fire({ icon: 'success', title: 'Excluída!', text: 'Assinatura removida com sucesso.', timer: 1500, showConfirmButton: false });
              }).catch(err => {
                  Swal.fire('Erro', 'Erro ao excluir assinatura: ' + err.message, 'error');
              });
          }
      });
  }


  function limparAssinatura() { let cvs = document.getElementById('canvasAssinatura'); let ctx = cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height); }
  function limparRemoto() { let cvs = document.getElementById('canvasRemoto'); let ctx = cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height); }
  function fecharAssinatura() { document.getElementById('assinaturaModal').style.display = 'none'; signId = null; }
  function finalizarAssinatura(tipo) { let imgAssinatura = document.getElementById('canvasAssinatura').toDataURL(); let salvar = document.getElementById('salvarAssinaturaCheck').checked; if (salvar && signId) { let c = clientes.find(x => x.id === signId); let itens = [...c.itens]; let checks = document.querySelectorAll(`.sel-${signId}:checked`); checks.forEach(cb => { let idx = parseInt(cb.value); if(itens[idx]) itens[idx].assinatura = imgAssinatura; }); db.collection("clientes").doc(signId).update({ itens }); } if (tipo === 'salvar_apenas') { Swal.fire({icon:'success',title:'Salvo!',timer:1000,showConfirmButton:false}); fecharAssinatura(); return; } imprimirSelecionados(signId, tipo, imgAssinatura); fecharAssinatura(); }
 function gerarLinkRemoto(id) { 
      let checks = document.querySelectorAll(`.sel-${id}:checked`);
      if (checks.length === 0) {
          return Swal.fire('Aviso', 'Selecione na tabela quais itens o cliente vai assinar agora.', 'warning');
      }
      
      // Pega os números das linhas marcadas e junta com vírgula (ex: 0,2,3)
      let indices = Array.from(checks).map(cb => cb.value).join(',');
      
      let l = `${window.location.href.split('?')[0]}?cliente=${id}&itens=${indices}`; 
      navigator.clipboard.writeText(l).then(() => Swal.fire({title: 'Link Copiado!', html: `Envie para o cliente assinar os itens selecionados:<br><br><b>${l}</b>`, icon: 'success'})); 
  }


function gerarImagemWhatsApp() {
  if (!empDados.end) { Swal.fire({ title: 'Aguarde...', text: 'Carregando dados...', icon: 'info', timer: 3000 }); return; }
  var c = clientes.find(function(x){ return x.id === signId; });
  if (!c) return;
  var checks = document.querySelectorAll('.sel-' + signId + ':checked');
  var indices = Array.from(checks).map(function(cb){ return parseInt(cb.value); });
  var selecionados = indices.map(function(idx){ return c.itens[idx]; });
  var totalS = selecionados.reduce(function(a, i){ return a + (Number(i.valor) || 0); }, 0);
  var totalPago = selecionados.reduce(function(a, i){ return a + (Number(i.pagoValor) || 0); }, 0);
  var assinatura = document.getElementById('canvasAssinatura').toDataURL();
  var html = '<div style="background:#fff; font-family:\'Courier New\'; padding:15px; border:1px solid #ccc; width:350px;">' +
    '<div style="text-align:center; font-weight:bold; margin-bottom:5px; font-size:16px;">' + empDados.nome + '</div>' +
    '<div style="text-align:center; font-size:11px; margin-bottom:10px; color:#333;">' + empDados.end + '<br>' + empDados.tel + '</div>' +
    '<hr style="border:0; border-top:1px dashed #000;">' +
    '<div style="font-size:12px; margin-bottom:10px;"><b>CLIENTE:</b> ' + c.nome.toUpperCase() + '</div>' +
    '<table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:10px;"><tr style="border-bottom:1px solid #000;"><th style="text-align:left;">Peca</th><th style="text-align:right;">Valor</th></tr>' +
    selecionados.map(function(i){ return '<tr><td style="text-align:left; padding:3px 0;">' + i.desc + '</td><td style="text-align:right; padding:3px 0;">' + formatarMoeda(i.valor) + '</td></tr>'; }).join('') +
    '</table><hr style="border:0; border-top:1px dashed #000;">' +
    '<div style="text-align:right; font-size:14px; font-weight:bold;">TOTAL: ' + formatarMoeda(totalS) + '</div>' +
    '<div style="text-align:right; font-size:12px;">PAGO: ' + formatarMoeda(totalPago) + '</div>' +
    '<div style="text-align:right; font-size:14px; font-weight:bold; color:red;">SALDO DEVEDOR: ' + formatarMoeda(totalS - totalPago) + '</div>' +
    '<div style="margin-top:20px; text-align:center;"><img src="' + assinatura + '" style="max-height:50px;"><br><span style="font-size:10px; color:#555;">Assinado Digitalmente</span></div>' +
    '<div style="margin-top:10px; text-align:center; font-size:9px; color:#aaa;">Emitido em: ' + new Date().toLocaleString('pt-BR') + '</div></div>';
  var area = document.getElementById('hiddenPrintArea');
  area.innerHTML = html;
  setTimeout(function(){
    html2canvas(area, opcoesHtml2CanvasAltaQualidade(area)).then(function(canvasImg){
      Swal.fire({ title: 'Imagem Gerada!', text: 'Segure na imagem para copiar.', imageUrl: canvasParaJpegDataUrl(canvasImg), imageWidth: 400, confirmButtonText: 'Fechar' });
      area.innerHTML = '';
      fecharAssinatura();
    });
  }, 500);
}

