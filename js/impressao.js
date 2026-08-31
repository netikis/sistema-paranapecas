'use strict';
/* Parana Pecas — impressao / PDF / JPEG / relatorios */

  function imprimirSelecionados(id, tipo, assinaturaImg = null) { const c = clientes.find(x => x.id === id); const checks = document.querySelectorAll(`.sel-${id}:checked`); const indices = Array.from(checks).map(cb => parseInt(cb.value)); if (indices.length === 0) return Swal.fire('Aviso', "Selecione itens", 'warning'); const selecionados = indices.map(idx => c.itens[idx]); const totalS = selecionados.reduce((a, i) => a + (Number(i.valor) || 0), 0); gerarImpressao(c, selecionados, totalS, tipo, "COMPROVANTE DE VENDA", assinaturaImg); }
  function imprimirExtratoGeral(id){ let c = clientes.find(x => x.id === id); if(!c.itens.length)return; let t = c.itens.reduce((a, i) => a + (Number(i.valor) || 0), 0); gerarImpressao(c, c.itens, t, 'extrato', "EXTRATO GERAL"); }
  
  function imprimirExtratoDebitos(id) {
      let c = clientes.find(x => x.id === id);
      if(!c) return;
      let pendentes = c.itens.filter(i => !i.pago);
      if(pendentes.length === 0) return Swal.fire('Aviso', 'Este cliente não possui débitos pendentes.', 'info');
      let totalPend = pendentes.reduce((a, i) => a + (Number(i.valor) || 0), 0);
      gerarImpressao(c, pendentes, totalPend, 'extrato', 'EXTRATO DE DÉBITOS PENDENTES');
  }

  function gerarRelatorioAssinaturas(id) {
      let c = clientes.find(x => x.id === id);
      if (!c) return;
      let assinados = c.itens.filter(i => i.assinatura);
      if (assinados.length === 0) return Swal.fire('Aviso', 'Nenhuma assinatura registrada para este cliente.', 'info');
      assinados.sort((a, b) => new Date(b.data) - new Date(a.data));
      const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="max-height:60px; display:block; margin:0 auto 5px auto;">` : '';
      let html = `
      <style>
        .audit-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .audit-table td { border: 1px solid #ccc; padding: 10px; vertical-align: middle; }
        .audit-info { width: 60%; }
        .audit-img { width: 40%; text-align: center; background: #f5f5f5; }
        .audit-img img { max-width: 100%; max-height: 80px; }
      </style>
      <div style="background:#fff; color:#000; padding:20px; font-family:Arial, sans-serif;">
          <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:10px;">
              ${logoHtml}
              <h2 style="margin:5px 0;">RELATÓRIO DE AUDITORIA DE RETIRADAS</h2>
              <div style="font-size:12px;">${empDados.nome}</div>
          </div>
          <div style="margin-top:20px; font-size:14px;">
              <b>CLIENTE:</b> ${c.nome.toUpperCase()}<br>
              <b>CPF/CNPJ:</b> ${c.cpf_cnpj || 'Não informado'}<br>
              <b>TOTAL DE ASSINATURAS:</b> ${assinados.length}
          </div>
          <table class="audit-table">
              <tr style="background:#ddd; font-weight:bold;">
                  <td style="text-align:center;">DETALHES DA RETIRADA</td>
                  <td style="text-align:center;">ASSINATURA REGISTRADA</td>
              </tr>
              ${assinados.map(i => `
              <tr>
                  <td class="audit-info">
                      <b>DATA:</b> ${formatarDataBR(i.data)}<br>
                      <b>ITEM:</b> ${i.desc.toUpperCase()}<br>
                      <b>VALOR:</b> ${formatarMoeda(i.valor)}<br>
                      <b>STATUS:</b> ${i.pago ? '<span style="color:green">PAGO</span>' : '<span style="color:red">EM ABERTO</span>'}
                  </td>
                  <td class="audit-img">
                      <img src="${i.assinatura}">
                  </td>
              </tr>
              `).join('')}
          </table>
          <div style="margin-top:30px; font-size:10px; text-align:center; color:#666;">
              Relatório gerado em ${new Date().toLocaleString()} - Sistema Gestão Pro
          </div>
      </div>
      `;
      document.getElementById('printContent').innerHTML = html;
      document.getElementById('printOverlay').style.display = 'block';
      window._ultimoPrintNome = (c.nome || 'auditoria').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  }

  function gerarImpressao(c, itens, total, tipo, titulo, assinaturaNova = null) {
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="max-height:60px; display:block; margin:0 auto 5px auto;">` : '';
    let totalPago = itens.reduce((acc, i) => acc + (Number(i.pagoValor) || 0), 0); let saldoDevedor = total - totalPago; let imgFinal = assinaturaNova || (itens.find(i=>i.assinatura)?.assinatura);
    
    let tabelaTotais = `
    <style>
        .blue { color: #0000AA !important; -webkit-print-color-adjust: exact; } 
        .green { color: #008000 !important; -webkit-print-color-adjust: exact; } 
        .red { color: #FF0000 !important; -webkit-print-color-adjust: exact; } 
    </style>
    <table class="totals-table">
        <tr><td class="label blue">TOTAL:</td><td class="value blue">${formatarMoeda(total)}</td></tr>
        <tr><td class="label green">PAGO:</td><td class="value green">${formatarMoeda(totalPago)}</td></tr>
        <tr><td class="label red">SALDO DEVEDOR:</td><td class="value red">${formatarMoeda(saldoDevedor)}</td></tr>
    </table>`;

    let cssTableItems = `
        .items-table th:nth-child(1), .items-table td:nth-child(1) { text-align: left !important; padding-left: 5px; }
        .items-table th:nth-child(2), .items-table td:nth-child(2) { text-align: center !important; }
        .items-table th:nth-child(3), .items-table td:nth-child(3) { text-align: right !important; }
    `;

    let headerLayout = `
        <div style="display:flex; align-items:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px;">
            <div style="width:100px; margin-right:15px; text-align:center;">${logoHtml}</div>
            <div style="flex:1; text-align:left;">
                <div style="font-size:20px; font-weight:900; color:#0d47a1; margin-bottom:5px;">${empDados.nome}</div>
                <div style="font-size:12px; font-weight:bold; color:#333;">${empDados.end}</div>
                <div style="font-size:12px; font-weight:bold; color:#333;">${empDados.tel}</div>
                <div style="font-size:12px; font-weight:bold; color:#333;">CNPJ: ${empDados.cnpj}</div>
            </div>
        </div>
    `;

    if(tipo === 'cupom'){
        headerLayout = `${logoHtml}<br><div class="title-lg" style="font-size:12px">${empDados.nome}</div><div style="font-size:10px">${empDados.end}<br>${empDados.tel}</div><div style="border-bottom: 2px solid #000; margin: 10px 0;"></div>`;
    }

    let conteudo = `
    <style>
    .print-area-container { background: #fff !important; color: #000 !important; width: 100%; height: 100%; }
    .main-table { width: 100%; border-collapse: collapse; margin-top: 10px; } 
    .main-table th { background-color: #ccc !important; color: #000 !important; font-weight: 900; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
    .main-table td { border-bottom: 1px dashed #000; padding: 6px 4px; font-weight: bold; font-size: 11px; color: #000 !important; } 
    ${cssTableItems}
    .text-left { text-align: left; } 
    .bold { font-weight: 800; } 
    .title-lg { font-size: 16px; font-weight: 800; text-transform: uppercase; } 
    .totals-table { width: auto; margin-left: auto; margin-top: 15px; border-collapse: collapse; }
    .totals-table td { padding: 2px 10px; text-align: right; border: none; font-weight: 900; font-size: 14px; }
    .label { font-weight: normal; font-size: 11px; text-align: right; }
    </style>
    <div class="print-area-container">
        <div style="width:100%; max-width:${tipo==='cupom'?'72mm':'180mm'}; margin:0 auto; font-family:Arial,sans-serif; text-align:center; color:#000;">
            ${headerLayout}
            <div class="title-lg" style="margin-top:10px;">${titulo}</div>
            <div class="text-left" style="margin-top:10px; border-bottom:1px solid #000; padding-bottom:5px;">
                <b>CLIENTE:</b> ${c.nome.toUpperCase()}<br>
                ${c.cpf_cnpj ? '<b>CPF/CNPJ:</b> '+c.cpf_cnpj : ''}
            </div>
            <table class="main-table items-table">
                <thead><tr><th>ITEM</th><th>QTD</th><th>VALOR</th></tr></thead>
                <tbody>${itens.map(i => {
                    let descExtra = "";
                    let pg = Number(i.pagoValor) || 0;
                    if(pg > 0 && !i.pago) descExtra = ` <br><small style="font-weight:normal;">(Pago: ${formatarMoeda(pg)})</small>`;
                    
                    if(i.pago) descExtra += ` <br><span style="border: 2px solid #2e7d32; color: #2e7d32; padding: 2px 4px; font-size: 10px; border-radius: 4px; font-weight: 900; display: inline-block; margin-top: 4px; background: rgba(46,125,50,0.1);">PAGO! PRODUTO ENTREGUE</span>`;

                    return `<tr><td>${i.desc.toUpperCase()}${descExtra}</td><td>${i.qtd||1}</td><td>${formatarMoeda(i.valor)}</td></tr>`;
                }).join('')}</tbody>
            </table>
            ${tabelaTotais}
            <div style="clear:both"></div>
            ${imgFinal ? `<div style="margin-top:20px; text-align:center;"><img src="${imgFinal}" style="max-height:60px;"><br>Assinado Digitalmente</div>` : '<br><br>__________________________<br>Assinatura'}
        </div>
    </div>`;
    
    document.getElementById('printContent').innerHTML = conteudo;
    document.getElementById('printOverlay').style.display = 'block';
    window._ultimoPrintNome = (c.nome || 'extrato').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  }

  window.onafterprint = function() {
      // Mantém o preview aberto para o usuário poder salvar PDF/JPEG após imprimir
  };

  function fecharImpressao() {
      document.getElementById('printOverlay').style.display = 'none';
      document.getElementById('printContent').innerHTML = ''; 
  }

  function _obterAreaImpressao() {
      return document.querySelector('#printContent .print-area-container') || document.getElementById('printContent');
  }

  function _nomeArquivoImpressao(ext) {
      const base = window._ultimoPrintNome || 'extrato';
      const data = new Date().toISOString().slice(0, 10);
      return `extrato_${base}_${data}.${ext}`;
  }

  function salvarImpressaoJPEG() {
      const area = _obterAreaImpressao();
      if (!area || !area.innerHTML.trim()) {
          return Swal.fire('Aviso', 'Nenhum extrato aberto para salvar.', 'warning');
      }
      Swal.fire({ title: 'Gerando JPEG...', text: 'Aguarde, gerando em alta qualidade...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      setTimeout(() => {
          html2canvas(area, opcoesHtml2CanvasAltaQualidade(area)).then(canvas => {
              canvasParaJpegBlob(canvas, blob => {
                  const link = document.createElement('a');
                  link.download = _nomeArquivoImpressao('jpg');
                  link.href = URL.createObjectURL(blob);
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
                  Swal.fire('Pronto!', 'JPEG salvo em alta qualidade.', 'success');
              });
          }).catch(err => {
              Swal.fire('Erro', 'Não foi possível gerar o JPEG: ' + err.message, 'error');
          });
      }, 200);
  }

  function salvarImpressaoPDF() {
      const area = _obterAreaImpressao();
      if (!area || !area.innerHTML.trim()) {
          return Swal.fire('Aviso', 'Nenhum extrato aberto para salvar.', 'warning');
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
          return Swal.fire('Erro', 'Biblioteca de PDF não carregou. Verifique a internet e atualize a página.', 'error');
      }
      Swal.fire({ title: 'Gerando PDF...', text: 'Aguarde, gerando em alta qualidade...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      setTimeout(() => {
          html2canvas(area, opcoesHtml2CanvasAltaQualidade(area)).then(canvas => {
              const imgData = canvasParaJpegDataUrl(canvas);
              const { jsPDF } = window.jspdf;
              const pdf = new jsPDF('p', 'mm', 'a4');
              const pageWidth = pdf.internal.pageSize.getWidth();
              const pageHeight = pdf.internal.pageSize.getHeight();
              const margin = 8;
              const imgWidth = pageWidth - (margin * 2);
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              let heightLeft = imgHeight;
              let position = margin;

              pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
              heightLeft -= (pageHeight - margin);

              while (heightLeft > 0) {
                  position = margin - (imgHeight - heightLeft);
                  pdf.addPage();
                  pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
                  heightLeft -= (pageHeight - margin);
              }

              pdf.save(_nomeArquivoImpressao('pdf'));
              Swal.fire('Pronto!', 'PDF salvo no seu dispositivo.', 'success');
          }).catch(err => {
              Swal.fire('Erro', 'Não foi possível gerar o PDF: ' + err.message, 'error');
          });
      }, 200);
  }


  function gerarRelatorioGeral() {
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="max-height:50px; margin-right:15px;">` : '';
    let headerLayout = `
        <div style="display:flex; align-items:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">
            ${logoHtml}
            <div style="text-align:left;">
                <div style="font-size:18px; font-weight:900;">${empDados.nome}</div>
                <div style="font-size:12px;">${empDados.end} | ${empDados.tel}</div>
            </div>
        </div>
    `;

    let totalGeralVendido = 0; let totalGeralRecebido = 0; let totalGeralDevedor = 0;

    let linhasTabela = clientes.map(c => {
        let t = c.itens.reduce((acc, i) => acc + (Number(i.valor)||0), 0);
        let p = c.itens.reduce((acc, i) => acc + (Number(i.pagoValor)||0), 0);
        let d = t - p;
        if (t === 0) return ''; 
        totalGeralVendido += t; totalGeralRecebido += p; totalGeralDevedor += d;
        let corDevedor = d > 0 ? 'red' : '#333';
        
        return `<tr>
            <td style="text-align:left; padding:5px; border-bottom:1px solid #ddd;">${c.nome.toUpperCase()}</td>
            <td style="text-align:right; padding:5px; border-bottom:1px solid #ddd;">${formatarMoeda(t)}</td>
            <td style="text-align:right; padding:5px; border-bottom:1px solid #ddd; color:green;">${formatarMoeda(p)}</td>
            <td style="text-align:right; padding:5px; border-bottom:1px solid #ddd; color:${corDevedor}; font-weight:bold;">${formatarMoeda(d)}</td>
        </tr>`;
    }).join('');

    let html = `
    <style>
        body { background: #fff; font-family: Arial, sans-serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #eee; text-align: right; padding: 8px; border-bottom: 2px solid #000; }
        th:first-child { text-align: left; }
        .totais { margin-top: 20px; font-size: 14px; font-weight: bold; text-align: right; }
    </style>
    <div style="padding:20px;">
        ${headerLayout}
        <h2 style="text-align:center; margin-bottom:20px;">BALANÇO GERAL DE CLIENTES</h2>
        <table>
            <thead><tr><th>CLIENTE</th><th>TOTAL COMPRADO</th><th>TOTAL PAGO</th><th>SALDO A RECEBER</th></tr></thead>
            <tbody>${linhasTabela}</tbody>
        </table>
        <div class="totais">
            <p>TOTAL VENDIDO: ${formatarMoeda(totalGeralVendido)}</p>
            <p style="color:green">TOTAL RECEBIDO: ${formatarMoeda(totalGeralRecebido)}</p>
            <p style="color:red; font-size:18px;">TOTAL A RECEBER NA RUA: ${formatarMoeda(totalGeralDevedor)}</p>
        </div>
        <br><br><p style="text-align:center; font-size:10px; color:#aaa">Gerado em: ${new Date().toLocaleString()}</p>
    </div>
    `;

    document.getElementById('printContent').innerHTML = html;
    document.getElementById('printOverlay').style.display = 'block';
    window._ultimoPrintNome = 'balanco_geral';
  }

