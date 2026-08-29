'use strict';
/* Parana Pecas — clientes / sync / render / cep */

  function buscarCep() {
      let cep = document.getElementById('cep').value.replace(/\D/g, ''); if (cep.length !== 8) return;
      document.getElementById('cidade').value = "Buscando..."; 
      if(document.getElementById('logradouro')) document.getElementById('logradouro').value = "Buscando...";
      fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(data => {
          if (!data.erro) { 
              document.getElementById('cidade').value = `${data.localidade} - ${data.uf}`; 
              if(document.getElementById('logradouro')) {
                  document.getElementById('logradouro').value = data.logradouro;
                  document.getElementById('bairro').value = data.bairro;
                  document.getElementById('numero').focus();
              }
              if(document.getElementById('editCliEnd')) document.getElementById('editCliEnd').value = `${data.logradouro} - ${data.bairro}`;
              document.getElementById('telefone').focus(); 
          }
          else { Swal.fire('Atenção', 'CEP não encontrado.', 'warning'); document.getElementById('cidade').value = ""; if(document.getElementById('logradouro')) document.getElementById('logradouro').value = ""; }
      }).catch(() => { });
  }


  function iniciarSincronizacao() {
      if(unsubscribeClientes) return; 
      unsubscribeClientes = db.collection("clientes").orderBy("nome").onSnapshot((snapshot) => { clientes = []; snapshot.forEach((doc) => { clientes.push({ id: doc.id, ...doc.data() }); }); atualizarSelect(); atualizarDashboard(); render(); });
      unsubscribeCatalogo = db.collection("catalogo").onSnapshot((s)=>{ catalogo=[]; let d=document.getElementById('opcoesCatalogo'); if(!d) return; d.innerHTML=''; s.forEach((doc)=>{ let k=doc.data(); catalogo.push({id:doc.id,...k}); d.innerHTML+=`<option value="${k.nome}">R$ ${k.valor}</option>`; }); });
      
   unsubscribeEmpresa = db.collection("config").doc("empresa").onSnapshot((doc) => {
          if (doc.exists) { 
              let d = doc.data(); 
              
              // Se for o formato antigo (só tinha o nome solto), migra para o formato de duas lojas
              if (d.nome && !d.emp1) {
                  configEmpresas.emp1 = { nome: d.nome, end: d.end || "", tel: d.tel || "", cnpj: d.cnpj || "" };
                  configEmpresas.ativo = 1;
                  db.collection("config").doc("empresa").set(configEmpresas, { merge: true });
              } else {
                  // Carrega o formato novo
                  configEmpresas.ativo = d.ativo || 1;
                  configEmpresas.emp1 = d.emp1 || { nome: "", end: "", tel: "", cnpj: "" };
                  configEmpresas.emp2 = d.emp2 || { nome: "", end: "", tel: "", cnpj: "" };
              }

              // Define a loja ativa globalmente para as impressões usarem
              empDados = configEmpresas.ativo === 2 ? configEmpresas.emp2 : configEmpresas.emp1; 
              
              if(d.logo) { logoBase64 = d.logo; aplicarLogo(); }
              
              // Preenche os campos da tela de configuração
              carregarFormEmpresa();
          }
      });

      aplicarLogo();
  }
  function pararSincronizacao() { if(unsubscribeClientes) { unsubscribeClientes(); unsubscribeClientes = null; } clientes = []; }


  function render(){
    let div = document.getElementById('listaClientes'); div.innerHTML = '';
    let termo = document.getElementById('searchBox').value.toLowerCase();
    let listaFiltrada = clientes.filter(c => !termo || c.nome.toLowerCase().includes(termo) || (c.cpf_cnpj && c.cpf_cnpj.includes(termo)));
    let totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina);
    if(paginaAtual > totalPaginas && totalPaginas > 0) paginaAtual = totalPaginas; if(totalPaginas === 0) paginaAtual = 1;
    let itensDaPagina = listaFiltrada.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

    document.getElementById('pageInfo').innerText = `Pág ${paginaAtual} de ${totalPaginas || 1}`;
    document.getElementById('btnAnt').disabled = (paginaAtual === 1); document.getElementById('btnProx').disabled = (paginaAtual >= totalPaginas || totalPaginas === 0);

    itensDaPagina.forEach((c) => {
      let saldoCli = c.itens.reduce((acc, i) => acc + (Number(i.valor)||0) - (Number(i.pagoValor)||0), 0);
      
      // NOVA BARRA DE FERRAMENTAS ORGANIZADA COM BOTÃO DESFAZER
      let btnHtml = `
      <div class="top-actions">
       <div class="action-group">
            <button class="btn-action blue" onclick="abrirLancarRapido('${c.id}', '${c.nome}')" title="Adicionar Nova Peça">➕ ADC. PEÇA</button>
            <button class="btn-action wapp" onclick="pagarSelecionados('${c.id}')" title="Receber todos os itens marcados">💲 REC. SELEÇÃO</button>
            <button class="btn-action blue" onclick="editarDadosCliente('${c.id}')" title="Editar Dados do Cliente">✏️ EDITAR</button>
        </div>
        <div class="action-group">
            <button class="btn-action gray" onclick="imprimirSelecionados('${c.id}', 'extrato')" title="Imprimir em folha A4">📄 A4</button>
            <button class="btn-action gray" onclick="imprimirSelecionados('${c.id}', 'cupom')" title="Imprimir em Cupom Térmico">🖨️ CUPOM</button>
            <button class="btn-action gray" onclick="imprimirExtratoDebitos('${c.id}')" title="Imprimir Extrato de Débitos">📄 EXTRATO</button>
        </div>
        <div class="action-group">
            <button class="btn-action dark" onclick="abrirAssinatura('${c.id}')" title="Assinar na Tela">✍️ ASSINAR</button>
            <button class="btn-action dark" onclick="gerarLinkRemoto('${c.id}')" title="Copiar Link para Assinar">🔗 LINK</button>
            <button class="btn-action dark" onclick="gerarRelatorioAssinaturas('${c.id}')" title="Auditoria de Assinaturas">🕵️ AUDITORIA</button>
        </div>
        <div class="action-group">
            <button class="btn-action wapp" onclick="cobrarWhatsApp('${c.id}')" title="Cobrar por WhatsApp">💬 COBRAR</button>
            <button class="btn-action wapp" onclick="compartilharComprovanteImagem('${c.id}')" title="Enviar Comprovante no WhatsApp">📤 ZAP DOC</button>
        </div>
        <div class="action-group admin-only">
            <button class="btn-action red" onclick="excluirSelecionados('${c.id}')" title="Excluir Itens Marcados na Tabela">🗑️ ITENS SEL.</button>
            <button class="btn-action orange" onclick="desfazerExclusao('${c.id}')" title="Desfazer exclusão de itens neste cliente">↩️ DESFAZER</button>
            <button class="btn-action red" onclick="excluirCliente('${c.id}')" title="Excluir Cadastro Inteiro do Cliente">🗑️ CLIENTE</button>
        </div>
      </div>`;

      let html = `<div class="client-card"><div style="display:flex; justify-content:space-between; align-items:flex-start"><div><b style="font-size:24px; font-weight:900; color:#0d47a1; text-transform:uppercase;">${c.nome}</b><br><span style="font-size:14px; color:#333; font-weight:bold">${c.cpf_cnpj ? 'CPF: '+c.cpf_cnpj : ''} ${c.telefone ? '| '+c.telefone : ''}<br>${c.endereco ? c.endereco : ''}</span></div><div style="text-align:right">Saldo Devedor<br><span style="color:red; font-size:24px; font-weight:900">${formatarMoeda(saldoCli)}</span></div></div>
      ${btnHtml}
      <table><thead><tr><th title="Selecionar Todos os Itens"><input type="checkbox" onchange="toggleAll('${c.id}', this)"></th><th>Peça</th><th>Qtd</th><th>Valor</th><th>Data</th><th>Venc.</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${c.itens.map((i, ii) => {
      
      let pg = Number(i.pagoValor) || 0;
      let isVencido = (!i.pago && i.venc && i.venc < new Date().toISOString().split('T')[0]);
      
      let sit = i.pago ? '<div class="carimbo-pago">PAGO!<br>PRODUTO ENTREGUE</div>' : (pg > 0 ? `<span style="color:#fbc02d;font-weight:900">PARCIAL<br><small style="color:#000">Pago: ${formatarMoeda(pg)}</small></span>` : `<span style="font-weight:900">${isVencido?'VENCIDO':'Aberto'}</span>`);
      
      let btnVerAssinatura = i.assinatura ? `<button class="dark" style="padding:2px 5px; font-size:10px; margin-left:5px;" onclick="verAssinatura('${c.id}', ${ii})">👁️ VER</button><button class="danger admin-only" style="padding:2px 5px; font-size:10px; margin-left:2px;" onclick="excluirAssinatura('${c.id}', ${ii})" title="Excluir Assinatura">🗑️ ASS.</button>` : '';

      return `<tr ${isVencido?'class="vencido"':''}><td><input type="checkbox" class="sel-${c.id}" value="${ii}" style="width:18px; height:18px;"></td><td style="text-align:left; font-weight:900; font-size:14px;">${i.desc}${btnVerAssinatura}</td><td style="font-weight:900; font-size:14px;">${i.qtd||1}</td><td style="font-weight:900; font-size:14px;">${formatarMoeda(i.valor)}</td><td style="font-weight:900; font-size:14px;">${formatarDataBR(i.data)}</td><td style="font-weight:900; font-size:14px;">${formatarDataBR(i.venc)}</td><td style="font-weight:900; font-size:14px;">${sit}</td><td><div class="table-actions"><button class="success" onclick="pagar('${c.id}',${ii})">$</button><button class="primary admin-only" onclick="abrirEditar('${c.id}',${ii})">✏️</button><button class="danger admin-only" onclick="excluirLançamento('${c.id}',${ii})">X</button></div></td></tr>`}).join('')}</tbody></table></div>`;
      div.innerHTML += html;
    });
  }
  function mudarPagina(delta) { paginaAtual += delta; render(); }


  function editarDadosCliente(id) { let c = clientes.find(x => x.id === id); if(!c) return; document.getElementById('editCliId').value = id; document.getElementById('editCliNome').value = c.nome; document.getElementById('editCliCpf').value = c.cpf_cnpj || ''; document.getElementById('editCliIe').value = c.ie || ''; document.getElementById('editCliTel').value = c.telefone || ''; document.getElementById('editCliCep').value = c.cep || ''; document.getElementById('editCliCidade').value = c.cidade || ''; document.getElementById('editCliEnd').value = c.endereco || ''; document.getElementById('modalEditarCliente').style.display = 'flex'; }
  function confirmarEdicaoCliente() { let id = document.getElementById('editCliId').value; let dados = { nome: document.getElementById('editCliNome').value, cpf_cnpj: document.getElementById('editCliCpf').value, ie: document.getElementById('editCliIe').value, telefone: document.getElementById('editCliTel').value, cep: document.getElementById('editCliCep').value, cidade: document.getElementById('editCliCidade').value, endereco: document.getElementById('editCliEnd').value }; db.collection("clientes").doc(id).update(dados).then(() => { Swal.fire('Sucesso', 'Dados atualizados!', 'success'); document.getElementById('modalEditarCliente').style.display = 'none'; }).catch(err => Swal.fire('Erro', err.message, 'error')); }


  function atualizarSelect(){let s=document.getElementById('clienteSelect'),c=s.value;s.innerHTML='<option value="">Selecione...</option>';clientes.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach((k)=>{let o=document.createElement('option');o.value=k.id;o.textContent=k.nome;s.appendChild(o)});if(c)s.value=c;}
  
  function adicionarCliente(){
      let n=document.getElementById('nome').value.trim();
      if(!n)return Swal.fire('Erro','Nome obrigatório','error');

      // PEGA OS CAMPOS INDIVIDUAIS
      let log = document.getElementById('logradouro').value;
      let num = document.getElementById('numero').value;
      let bai = document.getElementById('bairro').value;
      let comp = document.getElementById('complemento').value;

      // MONTA O ENDEREÇO COMPLETO PARA FICAR COMPATÍVEL COM O RESTO DO SISTEMA
      let enderecoCompleto = "";
      if(log) {
          enderecoCompleto = `${log}, ${num} - ${bai}`;
          if(comp) enderecoCompleto += ` (${comp})`;
      } else {
          // Fallback caso o usuário não preencha nada (para não dar erro)
          enderecoCompleto = document.getElementById('endereco') ? document.getElementById('endereco').value : ""; 
      }

      db.collection("clientes").add({
          nome:n,
          cpf_cnpj:document.getElementById('cpf_cnpj').value,
          ie:document.getElementById('ie').value,
          telefone:document.getElementById('telefone').value,
          cep:document.getElementById('cep').value,
          cidade:document.getElementById('cidade').value,
          endereco: enderecoCompleto, // SALVA TUDO JUNTO AQUI
          itens:[]
      });
      Swal.fire('Sucesso','Cliente salvo','success');
      
      // Limpa os campos após salvar
      document.getElementById('nome').value = '';
      document.getElementById('cpf_cnpj').value = '';
      document.getElementById('ie').value = '';
      document.getElementById('telefone').value = '';
      document.getElementById('cep').value = '';
      document.getElementById('cidade').value = '';
      document.getElementById('logradouro').value = '';
      document.getElementById('numero').value = '';
      document.getElementById('bairro').value = '';
      document.getElementById('complemento').value = '';
  }


  function excluirCliente(id){Swal.fire({title:'Excluir Cliente?',icon:'warning',showCancelButton:true,confirmButtonColor:'#d33',confirmButtonText:'Excluir Tudo'}).then((r)=>{if(r.isConfirmed)db.collection("clientes").doc(id).delete();});}


  async function limparSistema() {
      const confirmacao = await Swal.fire({
          title: 'ATENÇÃO MÁXIMA!',
          html: '<div style="text-align:left;">Esta ferramenta fará uma varredura para corrigir o banco de dados:<br><br>' +
                '1. <b>Remove Clientes Vazios:</b> Apaga cadastros sem nome criados por erro.<br>' +
                '2. <b>Fusiona Duplicados:</b> Se houver dois clientes com o <b>MESMO NOME</b>, o sistema manterá apenas o que tiver <b>MAIS VENDAS</b> e apagará o duplicado vazio.<br><br>' +
                '<b>Essa ação não pode ser desfeita!</b> Deseja continuar?</div>',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'SIM, LIMPAR TUDO',
          cancelButtonText: 'Cancelar'
      });

      if (!confirmacao.isConfirmed) return;

      Swal.fire({
          title: 'Processando...',
          html: 'Analisando duplicidades e erros no banco de dados...',
          allowOutsideClick: false,
          didOpen: () => { Swal.showLoading() }
      });

      try {
          const snapshot = await db.collection("clientes").get();
          let clientesParaVerificar = [];
          
          snapshot.forEach(doc => {
              clientesParaVerificar.push({ id: doc.id, ...doc.data() });
          });

          let batch = db.batch();
          let contadorBatch = 0;
          let totalExcluidosErro = 0;
          let totalDuplicadosResolvidos = 0;
          
          let mapaNomes = {};

          for (let i = 0; i < clientesParaVerificar.length; i++) {
              let c = clientesParaVerificar[i];
              let nomeFormatado = c.nome ? c.nome.trim().toUpperCase() : "";

              if (!nomeFormatado || nomeFormatado === "NULL" || nomeFormatado === "UNDEFINED") {
                  let ref = db.collection("clientes").doc(c.id);
                  batch.delete(ref);
                  contadorBatch++;
                  totalExcluidosErro++;
                  continue; 
              }

              if (mapaNomes[nomeFormatado]) {
                  let cadastroExistente = mapaNomes[nomeFormatado]; 
                  let cadastroAtual = c; 

                  let itensExistente = cadastroExistente.itens ? cadastroExistente.itens.length : 0;
                  let itensAtual = cadastroAtual.itens ? cadastroAtual.itens.length : 0;

                  let idParaApagar;

                  if (itensAtual > itensExistente) {
                      idParaApagar = cadastroExistente.id;
                      mapaNomes[nomeFormatado] = cadastroAtual;
                  } else {
                      idParaApagar = cadastroAtual.id;
                  }

                  let ref = db.collection("clientes").doc(idParaApagar);
                  batch.delete(ref);
                  contadorBatch++;
                  totalDuplicadosResolvidos++;

              } else {
                  mapaNomes[nomeFormatado] = c;
              }

              if (contadorBatch >= 450) {
                  await batch.commit();
                  batch = db.batch();
                  contadorBatch = 0;
              }
          }

          if (contadorBatch > 0) {
              await batch.commit();
          }

          Swal.fire({
              icon: 'success',
              title: 'Limpeza Concluída!',
              html: `O sistema foi otimizado com sucesso:<br><br>` +
                    `🗑️ <b>${totalExcluidosErro}</b> cadastros vazios/erros removidos.<br>` +
                    `👥 <b>${totalDuplicadosResolvidos}</b> duplicidades resolvidas.<br><br>` +
                    `Agora você tem apenas cadastros únicos e válidos.`
          });

      } catch (error) {
          console.error(error);
          Swal.fire('Erro', 'Ocorreu um erro ao tentar limpar: ' + error.message, 'error');
      }
  }

