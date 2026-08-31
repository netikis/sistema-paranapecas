'use strict';
/* Parana Pecas — utils + toast desfazer + formatacao */

  function mostrarToastUndo() {
      let toast = document.getElementById('undoToast');
      toast.style.display = 'flex';
      if(undoTimeout) clearTimeout(undoTimeout);
      // Fica na tela só por 5 segundos para não atrapalhar, mas o backup CONTINUA salvo na memória
      undoTimeout = setTimeout(() => { document.getElementById('undoToast').style.display = 'none'; }, 5000); 
  }

  function fecharToastUndo() {
      document.getElementById('undoToast').style.display = 'none';
      // Removido o bloqueio das variáveis aqui, para que o botão fixo da barra funcione sempre.
  }

  // Função Desfazer Inteligente
  function desfazerExclusao(idContexto = null) {
      let alvo = idContexto || backupClienteId;

      if(backupClienteId && backupItens && backupClienteId === alvo) {
          db.collection("clientes").doc(backupClienteId).update({ itens: backupItens }).then(() => {
              Swal.fire({icon: 'success', title: 'Restaurado!', text: 'Os itens voltaram para a lista.', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false});
              document.getElementById('undoToast').style.display = 'none';
              // Limpa a lixeira após restaurar
              backupClienteId = null;
              backupItens = null;
          });
      } else {
          Swal.fire('Aviso', 'Não há exclusões recentes para desfazer neste cliente.', 'info');
      }
  }


function formatarMoeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function formatarDataBR(i){if(!i)return'';let p=i.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:i;}
function toggleAll(id,s){document.querySelectorAll('.sel-'+id).forEach(function(c){c.checked=s.checked;});}
function aplicarLogo(){if(logoBase64){document.getElementById('logoLeft').src=logoBase64;document.getElementById('logoRight').src=logoBase64;document.getElementById('logoLogin').src=logoBase64;document.getElementById('logoLogin').style.display='inline-block';}}
function atualizarDashboard(){var t=0,r=0;clientes.forEach(function(c){c.itens.forEach(function(i){t+=(Number(i.valor)||0);r+=(Number(i.pagoValor)||0);});});document.getElementById('dashTotal').innerText=formatarMoeda(t);document.getElementById('dashRecebido').innerText=formatarMoeda(r);document.getElementById('dashDevedor').innerText=formatarMoeda(t-r);}

/** Exportação JPEG/PDF — alta nitidez (A4 / comprovante) */
var EXPORT_JPEG_QUALITY = 0.98;
var EXPORT_CANVAS_SCALE = 3;

function opcoesHtml2CanvasAltaQualidade(el) {
  var w = el.scrollWidth || el.offsetWidth;
  var h = el.scrollHeight || el.offsetHeight;
  return {
    scale: EXPORT_CANVAS_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: w,
    height: h,
    windowWidth: w,
    windowHeight: h
  };
}

function canvasParaJpegDataUrl(canvas) {
  return canvas.toDataURL('image/jpeg', EXPORT_JPEG_QUALITY);
}

function canvasParaJpegBlob(canvas, callback) {
  canvas.toBlob(callback, 'image/jpeg', EXPORT_JPEG_QUALITY);
}

