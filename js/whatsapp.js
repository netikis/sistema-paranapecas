'use strict';
/* Parana Pecas — cobranca e comprovante WhatsApp */

  function cobrarWhatsApp(id) { 
      let c = clientes.find(x => x.id === id); 
      if(!c.telefone) return Swal.fire('Erro','Cliente sem telefone cadastrado.','error'); 

      let checks = document.querySelectorAll(`.sel-${id}:checked`);
      let itensParaCobrar = [];

      // Se marcou algum checkbox, filtra apenas as peças marcadas e que não foram pagas
      if (checks.length > 0) {
          let indices = Array.from(checks).map(cb => parseInt(cb.value));
          itensParaCobrar = indices.map(idx => c.itens[idx]).filter(i => !i.pago);
      } else {
          // Se não marcou nada, puxa todas as peças do cliente que não estão pagas
          itensParaCobrar = c.itens.filter(i => !i.pago);
      }

      if(itensParaCobrar.length === 0) return Swal.fire('Info','Nenhum débito pendente nos itens verificados.','info');

      let totalCobrado = 0;
      let listaPecas = "";

      itensParaCobrar.forEach(i => {
          let valTotal = Number(i.valor) || 0;
          let valPago = Number(i.pagoValor) || 0;
          let valRestante = valTotal - valPago;
          totalCobrado += valRestante;
          
          listaPecas += `▪️ *${i.desc.toUpperCase()}* - Restante: ${formatarMoeda(valRestante)}\n`;
      });

      if (totalCobrado <= 0) return Swal.fire('Info','Sem débito pendente.','info');

      // MENSAGEM DINÂMICA
      let t = `Olá, tudo bem, aqui é da assistência de cobrança automática da empresa *${empDados.nome}*, segue em aberto/vencidos os seguintes itens abaixo:\n\n${listaPecas}\n*Total em aberto: ${formatarMoeda(totalCobrado)}*`; 
      
      window.open(`https://wa.me/55${c.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(t)}`,'_blank'); 
  }

  function compartilharComprovanteImagem(id) {
      if (!empDados.end) { Swal.fire({ title: 'Aguarde...', text: 'Carregando dados...', icon: 'info', timer: 3000 }); return; } 
      
      const c = clientes.find(x => x.id === id); 
      const checks = document.querySelectorAll(`.sel-${id}:checked`); 
      const indices = Array.from(checks).map(cb => parseInt(cb.value)); 
      const itens = (indices.length > 0) ? indices.map(idx => c.itens[idx]) : c.itens;
      
      let total = itens.reduce((a, i) => a + (Number(i.valor)||0), 0);
      let totalPago = itens.reduce((acc, i) => acc + (Number(i.pagoValor) || 0), 0);
      let saldoDevedor = total - totalPago;
      const assinatura = c.itens.find(i=>i.assinatura)?.assinatura; 

      let headerZap = `
        <div style="display:flex; align-items:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px;">
            <div style="width:100px; margin-right:15px; text-align:center;"><img src="${logoBase64}" style="max-height:80px;"></div>
            <div style="flex:1; text-align:left;">
                <div style="font-size:22px; font-weight:900; color:#0d47a1; margin-bottom:5px;">${empDados.nome}</div>
                <div style="font-size:12px; font-weight:bold; color:#333;">${empDados.end}</div>
                <div style="font-size:12px; font-weight:bold; color:#333;">${empDados.tel}</div>
            </div>
        </div>
      `;

      let html = `<div style="background:#fff; width:750px; padding:40px 20px 20px 20px; font-family:Arial; text-align:center; color:#000;">
        ${headerZap}
        <div style="font-size:20px; font-weight:bold; margin:10px 0;">COMPROVANTE DE VENDA</div>
        <div style="text-align:left; font-size:16px; margin-bottom:15px;"><b>CLIENTE:</b> ${c.nome.toUpperCase()}</div>
        <table style="width:100%; border-collapse:collapse;">
            <tr style="background:#ccc; border-top:2px solid #000; border-bottom:2px solid #000;">
                <th style="text-align:left; padding:8px; color:#000;">ITEM</th>
                <th style="text-align:center; padding:8px; color:#000;">QTD</th>
                <th style="text-align:right; padding:8px; color:#000;">VALOR</th>
            </tr>
            ${itens.map(i => `<tr>
                <td style="text-align:left; padding:8px; border-bottom:1px dashed #ccc; font-weight:bold;">${i.desc.toUpperCase()}</td>
                <td style="text-align:center; padding:8px; border-bottom:1px dashed #ccc; font-weight:bold;">${i.qtd || 1}</td>
                <td style="text-align:right; padding:8px; border-bottom:1px dashed #ccc; font-weight:bold;">${formatarMoeda(i.valor)}</td>
            </tr>`).join('')}
        </table>
        <div style="margin-top:20px; text-align:right; font-size:18px;">
            <div style="color:#0000AA; font-weight:900;">TOTAL: ${formatarMoeda(total)}</div>
            <div style="color:#008000; font-weight:900;">PAGO: ${formatarMoeda(totalPago)}</div>
            <div style="color:#FF0000; font-weight:900; font-size:22px;">SALDO DEVEDOR: ${formatarMoeda(saldoDevedor)}</div>
        </div>
        ${assinatura ? `<img src="${assinatura}" style="max-height:80px; margin-top:20px;">` : ''}
        <div style="font-size:12px; margin-top:20px; color:#666;">Gerado em ${new Date().toLocaleString()}</div>
      </div>`;

      let area = document.getElementById('hiddenPrintArea'); 
      area.innerHTML = html; 
      
      Swal.fire({ title: 'Gerando...', text: 'Preparando compartilhamento...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

      setTimeout(() => { 
          html2canvas(area, { scale: 1.5, useCORS: true }).then(canvas => {
              canvas.toBlob(blob => {
                  const file = new File([blob], `comprovante_${c.nome.replace(/\s+/g, '_')}.jpg`, { type: "image/jpeg" });
                  if (navigator.share && navigator.canShare({ files: [file] })) {
                       Swal.close();
                       navigator.share({
                          files: [file],
                          title: 'Comprovante Paraná Peças',
                          text: `Olá ${c.nome}, segue seu comprovante.`
                      }).then(() => console.log('Compartilhado com sucesso')).catch((error) => console.log('Erro ao compartilhar', error));
                  } else {
                      const link = document.createElement('a');
                      link.download = `comprovante_${c.nome}.jpg`;
                      link.href = canvas.toDataURL();
                      link.click();
                      Swal.fire('Baixado!', 'A imagem foi salva no seu dispositivo. Agora basta anexar no WhatsApp Web.', 'success');
                  }
                  area.innerHTML = '';
              }, 'image/jpeg', 0.9);
          });
      }, 800);
  }

