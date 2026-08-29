'use strict';
/* Parana Pecas — lancamentos / pagamentos / exclusoes */

  function abrirLancarRapido(id, nome) {
      document.getElementById('idCliRapido').value = id;
      document.getElementById('nomeCliRapido').innerText = "Cliente: " + nome;
      document.getElementById('descRapido').value = '';
      document.getElementById('qtdRapido').value = 1;
      document.getElementById('valorUnitRapido').value = '';
      document.getElementById('valorTotalRapido').value = '';
      document.getElementById('dataRapido').value = new Date().toISOString().split('T')[0];
      document.getElementById('vencRapido').value = '';
      document.getElementById('modalLancarRapido').style.display = 'flex';
      setTimeout(() => document.getElementById('descRapido').focus(), 100);
  }
  
  function fecharModalRapido() {
      document.getElementById('modalLancarRapido').style.display = 'none';
  }
  
  function preencherValorCatRapido() {
      let t = document.getElementById('descRapido').value.toUpperCase();
      let a = catalogo.find(c => c.nome === t);
      if(a) { 
          document.getElementById('valorUnitRapido').value = a.valor;
          calcularTotalRapido();
      }
  }

  function calcularTotalRapido() {
      let qtd = Number(document.getElementById('qtdRapido').value) || 0;
      let unit = Number(document.getElementById('valorUnitRapido').value) || 0;
      document.getElementById('valorTotalRapido').value = (qtd * unit).toFixed(2);
  }

  function confirmarLancamentoRapido() {
      let id = document.getElementById('idCliRapido').value;
      if (!id) return;
      let valFinal = Number(document.getElementById('valorTotalRapido').value);
      
      let item = { 
          desc: document.getElementById('descRapido').value.toUpperCase(), 
          qtd: Number(document.getElementById('qtdRapido').value)||1, 
          valor: valFinal, 
          data: document.getElementById('dataRapido').value || new Date().toISOString().split('T')[0], 
          venc: document.getElementById('vencRapido').value, 
          pago: false, pagoValor: 0, img: null 
      };
      
      if(!item.desc || !item.valor) return Swal.fire('Erro', 'Preencha descrição e valor', 'error');
      
      db.collection("clientes").doc(id).update({itens: firebase.firestore.FieldValue.arrayUnion(item)}).then(() => {
          Swal.fire({icon: 'success', title: 'Lançado!', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false});
          fecharModalRapido();
      });
  }


  function preencherValorCatPrincipal(){
      let t=document.getElementById('descricao').value.toUpperCase(),a=catalogo.find(c=>c.nome===t);
      if(a) {
          document.getElementById('valorUnitario').value=a.valor;
          calcularTotalPrincipal();
      }
  }
  
  function calcularTotalPrincipal() {
      let q = Number(document.getElementById('quantidade').value) || 0;
      let u = Number(document.getElementById('valorUnitario').value) || 0;
      document.getElementById('valorTotal').value = (q * u).toFixed(2);
  }


  function adicionarItem(){
      let id=document.getElementById('clienteSelect').value;
      if(!id)return Swal.fire('Erro','Selecione cliente','error');
      
      let valTotal = Number(document.getElementById('valorTotal').value);
      if(!valTotal) return Swal.fire('Erro', 'Valor total inválido', 'error');

      let item={
          desc:document.getElementById('descricao').value.toUpperCase(),
          qtd:Number(document.getElementById('quantidade').value)||1,
          valor: valTotal, 
          data:document.getElementById('dataEntrada').value||new Date().toISOString().split('T')[0],
          venc:document.getElementById('dataVenc').value,
          pago:false,pagoValor:0,img:null
      };
      
      db.collection("clientes").doc(id).update({itens:firebase.firestore.FieldValue.arrayUnion(item)}).then(()=>{
          Swal.fire({icon:'success',title:'Lançado',toast:true,position:'top-end',timer:1500,showConfirmButton:false});
      });
  }


  function pagar(id, ii) {
    let c = clientes.find(x => x.id === id);
    let itens = [...c.itens]; 

    const valorTotal = Number(itens[ii].valor) || 0;
    const valorPago = Number(itens[ii].pagoValor) || 0;
    const valorRestante = valorTotal - valorPago;
      
    let inputPagamento = prompt(
      `Restante: ${formatarMoeda(valorRestante)}\nQuanto foi pago? (Ex: 50.50 ou 50,50)`,
       valorRestante.toFixed(2)
    );
    
    if (inputPagamento === null) {
        return; 
    }
      
    let inputFormatado = inputPagamento.trim().replace(',', '.');
    let v = parseFloat(inputFormatado);

    if (!isNaN(v) && v > 0) {
        itens[ii].pagoValor = valorPago + v;

         if(itens[ii].pagoValor >= valorTotal) {
             itens[ii].pagoValor = valorTotal; 
             itens[ii].pago = true;
         }
         
        db.collection("clientes").doc(id).update({itens})
          .then(() => {
            Swal.fire({icon: 'success', title: 'Pagamento Registrado!', toast: true, position: 'top-end', timer: 1000, showConfirmButton: false});
          })
          .catch(error => {
              console.error("Erro ao registrar pagamento: ", error);
               Swal.fire('Erro', 'Ocorreu um erro ao salvar o pagamento.', 'error');
          });
    } else {
        Swal.fire('Erro', 'Valor inválido. Por favor, insira um número.', 'error');
    }
  }

  function abrirEditar(id,ii){let c=clientes.find(x=>x.id===id),i=c.itens[ii];editRef={id,ii};document.getElementById('editDesc').value=i.desc;document.getElementById('editQtd').value=i.qtd||1;document.getElementById('editValor').value=i.valor;document.getElementById('editData').value=i.data||"";document.getElementById('editVenc').value=i.venc||"";document.getElementById('editModal').style.display='flex';}
  function salvarEdicao(){let {id,ii}=editRef,c=clientes.find(x=>x.id===id),itens=[...c.itens];itens[ii].desc=document.getElementById('editDesc').value;itens[ii].qtd=Number(document.getElementById('editQtd').value);itens[ii].valor=Number(document.getElementById('editValor').value);itens[ii].data=document.getElementById('editData').value;itens[ii].venc=document.getElementById('editVenc').value;db.collection("clientes").doc(id).update({itens}).then(()=>fecharModal());}
  function fecharModal(){document.getElementById('editModal').style.display='none';}

  function excluirLançamento(id, ii) {
      Swal.fire({
          title: 'Excluir item?', 
          icon: 'warning', 
          showCancelButton: true, 
          confirmButtonColor: '#d33', 
          confirmButtonText: 'Sim'
      }).then((r) => {
          if (r.isConfirmed) {
              let c = clientes.find(x => x.id === id);
              
              // SALVA O BACKUP PARA O DESFAZER
              backupClienteId = id;
              backupItens = [...c.itens];
              
              let novosItens = [...c.itens];
              novosItens.splice(ii, 1);
              
              db.collection("clientes").doc(id).update({itens: novosItens}).then(() => {
                  mostrarToastUndo();
              });
          }
      });
  }

  function excluirSelecionados(id) {
      let c = clientes.find(x => x.id === id);
      let checks = document.querySelectorAll(`.sel-${id}:checked`);
      
      // Pega os índices e ordena do maior para o menor para evitar erro ao usar o splice()
      let indices = Array.from(checks).map(cb => parseInt(cb.value)).sort((a,b) => b - a);
      
      if (indices.length === 0) {
          return Swal.fire('Aviso', "Selecione pelo menos um item usando a caixinha na tabela antes de excluir.", 'warning');
      }

      Swal.fire({
          title: `Excluir ${indices.length} item(ns)?`,
          text: "Você poderá desfazer na barra de botões.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          cancelButtonText: 'Cancelar',
          confirmButtonText: 'Sim, excluir'
      }).then((result) => {
          if (result.isConfirmed) {
              // SALVA O BACKUP PARA O DESFAZER
              backupClienteId = id;
              backupItens = [...c.itens];

              let novosItens = [...c.itens];
              // Remove os itens selecionados do array
              indices.forEach(idx => {
                  novosItens.splice(idx, 1);
              });

              db.collection("clientes").doc(id).update({itens: novosItens}).then(() => {
                  mostrarToastUndo();
              });
          }
      });
  }


function pagarSelecionados(id) {
      let c = clientes.find(x => x.id === id);
      let checks = document.querySelectorAll(`.sel-${id}:checked`);
      
      if (checks.length === 0) {
          return Swal.fire('Aviso', 'Selecione os itens que deseja receber marcando as caixinhas na tabela.', 'warning');
      }
      
      let indices = Array.from(checks).map(cb => parseInt(cb.value));
      let itens = [...c.itens];
      
      let totalFaltante = 0;
      let qtdPendentes = 0;
      
      // Calcula quanto falta receber dos itens marcados
      indices.forEach(idx => {
          let i = itens[idx];
          if (!i.pago) {
              let valTotal = Number(i.valor) || 0;
              let valPago = Number(i.pagoValor) || 0;
              totalFaltante += (valTotal - valPago);
              qtdPendentes++;
          }
      });
      
      if (totalFaltante <= 0) {
          return Swal.fire('Info', 'Os itens selecionados já estão pagos.', 'info');
      }
      
      // Pergunta o valor que está sendo pago
      let inputPagamento = prompt(
          `Você selecionou ${qtdPendentes} item(ns) pendente(s).\nTotal Restante: ${formatarMoeda(totalFaltante)}\n\nInforme o valor recebido:`,
          totalFaltante.toFixed(2)
      );
      
      if (inputPagamento === null) return; // Se cancelar, não faz nada
      
      let inputFormatado = inputPagamento.trim().replace(',', '.');
      let valorRecebido = parseFloat(inputFormatado);

      if (isNaN(valorRecebido) || valorRecebido <= 0) {
          return Swal.fire('Erro', 'Valor inválido. Insira apenas números.', 'error');
      }
      
      // Distribui o dinheiro entre os itens selecionados (permite pagamento parcial)
      indices.forEach(idx => {
          let i = itens[idx];
          if (!i.pago && valorRecebido > 0) {
              let valTotal = Number(i.valor) || 0;
              let valPago = Number(i.pagoValor) || 0;
              let faltante = valTotal - valPago;
              
              if (valorRecebido >= faltante) {
                  // Paga o item inteiro
                  i.pagoValor = valTotal;
                  i.pago = true;
                  valorRecebido -= faltante; // Tira do bolo o que acabou de pagar
              } else {
                  // Dinheiro não deu pra tudo, paga parcial
                  i.pagoValor = valPago + valorRecebido;
                  valorRecebido = 0; // Acabou o dinheiro
              }
          }
      });
      
      // Salva no banco de dados
      db.collection("clientes").doc(id).update({itens})
        .then(() => {
            Swal.fire({icon: 'success', title: 'Pagamento Registrado!', text: 'Baixa múltipla realizada com sucesso.', timer: 2000, showConfirmButton: false});
            // Desmarca as caixinhas após pagar para não confundir
            document.querySelectorAll(`.sel-${id}`).forEach(c => c.checked = false);
        })
        .catch(error => {
            console.error("Erro ao registrar pagamento: ", error);
            Swal.fire('Erro', 'Ocorreu um erro ao salvar o pagamento.', 'error');
        });
  }

