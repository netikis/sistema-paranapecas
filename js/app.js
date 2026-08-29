'use strict';
/* Parana Pecas — boot / mascaras / modo cliente */

$(document).ready(function(){
      $('#cep, #editCliCep').mask('00000-000'); 
      $('#telefone, #editCliTel').mask('(00) 00000-0000');
      $('#cpf_cnpj, #editCliCpf').mask('000.000.000-00', {onKeyPress: function(val, e, field, options) { field.mask(val.length > 14 ? '00.000.000/0000-00' : '000.000.000-000'); }});
      
      if(clienteIdUrl) {
          const itensParams = urlParams.get('itens');
          let indicesAssinar = itensParams ? itensParams.split(',').map(Number) : [];

          const cvsRemoto = document.getElementById('canvasRemoto');
          cvsRemoto.width = cvsRemoto.offsetWidth; cvsRemoto.height = 200;
          const ctxR = cvsRemoto.getContext('2d'); ctxR.lineWidth = 2; ctxR.strokeStyle = '#000';
          setupCanvasEvents(cvsRemoto);
          
          db.collection("clientes").doc(clienteIdUrl).onSnapshot((doc) => {
              if(doc.exists) {
                  let data = doc.data();
                  let html = `<b>Olá, ${data.nome}</b><br>Por favor, confira e assine a retirada dos itens abaixo:<br><br>`;
                  let total = 0;
                  
                  if(indicesAssinar.length > 0) {
                      // Mostra APENAS os itens que você selecionou no sistema
                      indicesAssinar.forEach(idx => {
                          let i = data.itens[idx];
                          if(i) {
                              html += `📦 ${i.desc} - ${formatarMoeda(i.valor)}<br>`; 
                              total += (Number(i.valor)||0);
                          }
                      });
                  } else {
                      // Fallback: se usar um link antigo, mostra o padrão anterior
                      data.itens.forEach(i => { 
                          if(!i.pago) { 
                              html += `📦 ${i.desc} - ${formatarMoeda(i.valor)}<br>`; 
                              total += (Number(i.valor)||0); 
                          } 
                      });
                  }
                  
                  html += `<hr><b>TOTAL DOS ITENS: ${formatarMoeda(total)}</b>`;
                  document.getElementById('listaItensRemoto').innerHTML = html;
              }
          });
      }
  });

