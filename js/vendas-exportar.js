'use strict';
/* Parana Pecas — exportacao PDF / Excel do modulo Vendas / Saidas (depende de js/vendas.js) */

const VS_FMT_MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const VS_COR_TIPO = { venda: [13, 71, 161], saida: [198, 40, 40] };

/* jsPDF nao lida bem com o espaco nao separavel que o toLocaleString coloca depois do "R$" */
function vsMoedaPdf(v) { return vsMoeda(v).replace(/\s/g, ' '); }
function vsNomeMesArquivo() { return vsMes.ano + '-' + String(vsMes.mes + 1).padStart(2, '0'); }
function vsTotal(lista) { return lista.reduce((s, l) => s + (Number(l.valor) || 0), 0); }

function vsBibliotecaOk(nome, ok) {
  if (ok) return true;
  Swal.fire('Erro', `Não foi possível carregar o gerador de ${nome}. Verifique a internet e recarregue a página.`, 'error');
  return false;
}

/* ---------- PDF ---------- */
function vsNovoPdf(titulo, subtitulo) {
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(vsEmpresaNome, 14, 16);
  doc.setFontSize(12);
  doc.text(titulo, 14, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(subtitulo, 14, 29);
  doc.setTextColor(0);
  return doc;
}

function vsRodapePdf(doc) {
  const paginas = doc.internal.getNumberOfPages();
  const emitido = 'Emitido em ' + new Date().toLocaleString('pt-BR');
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(emitido, 14, 290);
    doc.text(`Página ${i} de ${paginas}`, 196, 290, { align: 'right' });
  }
}

/* O que esta na tela de Vendas/Saidas: o mes inteiro ou o resultado da busca */
function vsDadosExportacao(tipo) {
  const vis = vsListaVisivel(tipo);
  const prefixo = tipo === 'venda' ? 'vendas' : 'saidas';
  const nomeTipo = tipo === 'venda' ? 'VENDAS' : 'SAÍDAS';
  const mesTxt = `${VS_MESES[vsMes.mes].toUpperCase()} ${vsMes.ano}`;
  if (!vis.buscando) {
    return { lista: vis.lista, comData: false, titulo: `${nomeTipo} - ${mesTxt}`,
      rotuloTotal: 'TOTAL DO MÊS', arquivo: `${prefixo}-${vsNomeMesArquivo()}`,
      aba: (tipo === 'venda' ? 'Vendas ' : 'Saídas ') + String(vsMes.mes + 1).padStart(2, '0') + '-' + vsMes.ano };
  }
  return { lista: vis.lista, comData: vis.todos,
    titulo: `${nomeTipo} - BUSCA "${vis.termo.toUpperCase()}" (${vis.todos ? 'TODOS OS MESES' : mesTxt})`,
    rotuloTotal: 'TOTAL ENCONTRADO', arquivo: `${prefixo}-busca${vis.todos ? '' : '-' + vsNomeMesArquivo()}`,
    aba: 'Busca ' + (tipo === 'venda' ? 'vendas' : 'saídas') };
}

function vsExportarMesPdf(tipo) {
  if (!vsBibliotecaOk('PDF', window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) return;
  const dados = vsDadosExportacao(tipo);
  const lista = dados.lista;
  if (!lista.length) return vsAviso('Nenhum lançamento na tela para exportar.');

  const doc = vsNovoPdf(dados.titulo, `${lista.length} lançamento(s)`);
  doc.autoTable({
    startY: 34,
    theme: 'grid',
    head: [[dados.comData ? 'DATA' : 'DIA', 'QTD', VS_TIPOS[tipo].colDesc, 'VALOR']],
    body: lista.map(l => [dados.comData ? vsDataBr(l.data) : String(l.data).slice(8), l.qtd || 1, l.desc || '', vsMoedaPdf(l.valor)]),
    foot: [[{ content: dados.rotuloTotal, colSpan: 3, styles: { halign: 'right' } }, vsMoedaPdf(vsTotal(lista))]],
    showFoot: 'lastPage',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [68, 68, 68], halign: 'center' },
    footStyles: { fillColor: VS_COR_TIPO[tipo], textColor: 255, fontSize: 11 },
    columnStyles: { 0: { halign: 'center', cellWidth: dados.comData ? 24 : 15 }, 1: { halign: 'center', cellWidth: 15 }, 3: { halign: 'right', cellWidth: 35 } },
    margin: { bottom: 15 }
  });

  vsRodapePdf(doc);
  doc.save(dados.arquivo + '.pdf');
}

function vsExportarDespesaPdf() {
  if (!vsBibliotecaOk('PDF', window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) return;
  if (!vsDespesas.length) return vsAviso('Nenhuma despesa neste mês para exportar.');

  const doc = vsNovoPdf(`DESPESAS MENSAIS - ${VS_MESES[vsMes.mes].toUpperCase()} ${vsMes.ano}`,
    `${vsDespesas.length} despesa(s)`);
  doc.autoTable({
    startY: 34,
    theme: 'grid',
    head: [['DESCRIÇÃO', 'VALOR']],
    body: vsDespesas.map(d => [
      vsDespRotulo(d) + (d.tipo === 'fornecedor'
        ? (d.boletos || []).map(b => `\n     - ${b.desc || 'BOLETO'}: ${vsMoedaPdf(b.valor)}`).join('')
        : ''),
      vsMoedaPdf(d.valor)
    ]),
    foot: [[{ content: 'TOTAL DE DESPESAS', styles: { halign: 'right' } }, vsMoedaPdf(vsTotal(vsDespesas))]],
    showFoot: 'lastPage',
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [68, 68, 68], halign: 'center' },
    footStyles: { fillColor: [239, 108, 0], textColor: 255, fontSize: 11 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    margin: { bottom: 15 }
  });

  vsRodapePdf(doc);
  doc.save(`despesas-${vsNomeMesArquivo()}.pdf`);
}

function vsExportarRelatorioPdf() {
  if (!vsBibliotecaOk('PDF', window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) return;
  const dados = vsRelatorioDados;
  if (!dados || dados.ano !== vsAnoRelatorio) return vsAviso('Aguarde o relatório terminar de carregar.');

  const tot = vsTotaisAno(dados.meses);
  const doc = vsNovoPdf(`RELATÓRIO GERAL - BALANCETE ${dados.ano}`,
    `Vendas: ${vsMoedaPdf(tot.venda)}   |   Saídas: ${vsMoedaPdf(tot.saida)}   |   Saldo: ${vsMoedaPdf(tot.venda - tot.saida)}`);

  doc.autoTable({
    startY: 34,
    theme: 'grid',
    head: [['MÊS', 'VENDAS', 'SAÍDAS', 'SALDO']],
    body: dados.meses.map((m, i) => [VS_MESES[i], vsMoedaPdf(m.venda), vsMoedaPdf(m.saida), vsMoedaPdf(m.venda - m.saida)]),
    foot: [['TOTAL DO ANO', vsMoedaPdf(tot.venda), vsMoedaPdf(tot.saida), vsMoedaPdf(tot.venda - tot.saida)]],
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [68, 68, 68], halign: 'center' },
    footStyles: { fillColor: [13, 71, 161], textColor: 255, fontSize: 11, halign: 'right' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 3) {
        const m = dados.meses[data.row.index];
        data.cell.styles.textColor = m.venda - m.saida < 0 ? [198, 40, 40] : [46, 125, 50];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'foot' && data.column.index === 0) data.cell.styles.halign = 'left';
    }
  });

  vsRodapePdf(doc);
  doc.save(`balancete-${dados.ano}.pdf`);
}

/* ---------- Excel ---------- */
function vsPlanilha(linhas, colunasMoeda, larguras) {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const faixa = XLSX.utils.decode_range(ws['!ref']);
  for (let r = faixa.s.r; r <= faixa.e.r; r++) {
    colunasMoeda.forEach(c => {
      const cel = ws[XLSX.utils.encode_cell({ r: r, c: c })];
      if (cel && cel.t === 'n') cel.z = VS_FMT_MOEDA;
    });
  }
  ws['!cols'] = larguras.map(w => ({ wch: w }));
  return ws;
}

/* Troca o valor fixo da celula por uma formula SOMA, mantendo o valor calculado */
function vsFormulaSoma(ws, linha, coluna, linhaIni, linhaFim) {
  if (linhaFim < linhaIni) return;
  const letra = XLSX.utils.encode_col(coluna);
  ws[XLSX.utils.encode_cell({ r: linha, c: coluna })].f = `SUM(${letra}${linhaIni + 1}:${letra}${linhaFim + 1})`;
}

function vsPlanilhaLancamentos(lista, colDesc, comData, rotuloTotal) {
  const cab = comData ? ['DATA', 'QTD', colDesc, 'VALOR'] : ['DIA', 'QTD', colDesc, 'VALOR'];
  const linhas = [cab].concat(lista.map(l => [
    comData ? vsDataBr(l.data) : parseInt(String(l.data).slice(8), 10),
    Number(l.qtd) || 1,
    l.desc || '',
    Number(l.valor) || 0
  ]));
  linhas.push(['', '', rotuloTotal, vsTotal(lista)]);
  const ws = vsPlanilha(linhas, [3], [comData ? 12 : 6, 6, 50, 16]);
  vsFormulaSoma(ws, linhas.length - 1, 3, 1, linhas.length - 2);
  return ws;
}

function vsExportarMesExcel(tipo) {
  if (!vsBibliotecaOk('Excel', window.XLSX)) return;
  const dados = vsDadosExportacao(tipo);
  if (!dados.lista.length) return vsAviso('Nenhum lançamento na tela para exportar.');

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,
    vsPlanilhaLancamentos(dados.lista, VS_TIPOS[tipo].colDesc, dados.comData, dados.rotuloTotal), dados.aba);
  XLSX.writeFile(wb, dados.arquivo + '.xlsx');
}

function vsExportarDespesaExcel() {
  if (!vsBibliotecaOk('Excel', window.XLSX)) return;
  if (!vsDespesas.length) return vsAviso('Nenhuma despesa neste mês para exportar.');

  const linhas = [['DESCRIÇÃO', 'VALOR']].concat(vsDespesas.map(d => [vsDespRotulo(d), Number(d.valor) || 0]));
  linhas.push(['TOTAL DE DESPESAS', vsTotal(vsDespesas)]);
  const ws = vsPlanilha(linhas, [1], [50, 16]);
  vsFormulaSoma(ws, linhas.length - 1, 1, 1, linhas.length - 2);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Despesas ' + String(vsMes.mes + 1).padStart(2, '0') + '-' + vsMes.ano);

  const boletos = [];
  vsDespesas.filter(d => d.tipo === 'fornecedor').forEach(d =>
    (d.boletos || []).forEach(b => boletos.push([d.desc || '', b.desc || 'BOLETO', Number(b.valor) || 0])));
  if (boletos.length) {
    const linhasB = [['FORNECEDOR', 'BOLETO / DESCRIÇÃO', 'VALOR']].concat(boletos);
    linhasB.push(['', 'TOTAL FORNECEDORES', boletos.reduce((s, b) => s + b[2], 0)]);
    const wsB = vsPlanilha(linhasB, [2], [25, 40, 16]);
    vsFormulaSoma(wsB, linhasB.length - 1, 2, 1, linhasB.length - 2);
    XLSX.utils.book_append_sheet(wb, wsB, 'Boletos fornecedores');
  }
  XLSX.writeFile(wb, `despesas-${vsNomeMesArquivo()}.xlsx`);
}

function vsExportarRelatorioExcel() {
  if (!vsBibliotecaOk('Excel', window.XLSX)) return;
  const dados = vsRelatorioDados;
  if (!dados || dados.ano !== vsAnoRelatorio) return vsAviso('Aguarde o relatório terminar de carregar.');

  const tot = vsTotaisAno(dados.meses);
  const linhas = [['MÊS', 'VENDAS', 'SAÍDAS', 'SALDO']]
    .concat(dados.meses.map((m, i) => [VS_MESES[i], m.venda, m.saida, m.venda - m.saida]));
  linhas.push(['TOTAL DO ANO', tot.venda, tot.saida, tot.venda - tot.saida]);

  const wsBalancete = vsPlanilha(linhas, [1, 2, 3], [16, 16, 16, 16]);
  const ultima = linhas.length - 1;
  for (let r = 1; r < ultima; r++) wsBalancete[XLSX.utils.encode_cell({ r: r, c: 3 })].f = `B${r + 1}-C${r + 1}`;
  [1, 2, 3].forEach(c => vsFormulaSoma(wsBalancete, ultima, c, 1, ultima - 1));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsBalancete, 'Balancete ' + dados.ano);
  XLSX.utils.book_append_sheet(wb, vsPlanilhaLancamentos(dados.lanc.venda, VS_TIPOS.venda.colDesc, true, 'TOTAL DO ANO'), 'Vendas ' + dados.ano);
  XLSX.utils.book_append_sheet(wb, vsPlanilhaLancamentos(dados.lanc.saida, VS_TIPOS.saida.colDesc, true, 'TOTAL DO ANO'), 'Saídas ' + dados.ano);
  XLSX.writeFile(wb, `balancete-${dados.ano}.xlsx`);
}
