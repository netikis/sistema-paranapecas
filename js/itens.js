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
      setTimeout(() => {
          let el = document.getElementById('descRapido');
          if (el) { el.focus(); if (el.select) el.select(); }
      }, 100);
  }
  
  function fecharModalRapido() {
      document.getElementById('modalLancarRapido').style.display = 'none';
      document.getElementById('descRapido').value = '';
      document.getElementById('qtdRapido').value = 1;
      document.getElementById('valorUnitRapido').value = '';
      document.getElementById('valorTotalRapido').value = '';
      document.getElementById('vencRapido').value = '';
  }
  
  function preencherValorCatRapido() {
      let t = (document.getElementById('descRapido').value || '').trim().toUpperCase();
      let a = catalogo.find(c => c.nome.toUpperCase() === t);
      if(a) { 
          document.getElementById('valorUnitRapido').value = Number(a.valor).toFixed(2);
          calcularTotalRapido();
      }
  }

  function calcularTotalRapido() {
      let qtd = Number(document.getElementById('qtdRapido').value) || 0;
      let unit = parseFloat(String(document.getElementById('valorUnitRapido').value).replace(',', '.')) || 0;
      let total = Math.round(qtd * unit * 100) / 100;
      document.getElementById('valorTotalRapido').value = total > 0 ? total.toFixed(2) : (unit > 0 ? unit.toFixed(2) : '');
  }

  function tratarEnterRapido(e, campo) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (campo === 'desc') {
          preencherValorCatRapido();
          let inQtd = document.getElementById('qtdRapido');
          if (inQtd) { inQtd.focus(); if (inQtd.select) inQtd.select(); }
      } else if (campo === 'qtd') {
          calcularTotalRapido();
          let inUnit = document.getElementById('valorUnitRapido');
          if (inUnit) { inUnit.focus(); if (inUnit.select) inUnit.select(); }
      } else if (campo === 'unit') {
          calcularTotalRapido();
          confirmarLancamentoRapido();
      } else if (campo === 'data') {
          let inVenc = document.getElementById('vencRapido');
          if (inVenc) inVenc.focus();
      } else if (campo === 'venc') {
          confirmarLancamentoRapido();
      }
  }

  function confirmarLancamentoRapido() {
      let id = document.getElementById('idCliRapido').value;
      if (!id) return;

      calcularTotalRapido();

      let desc = (document.getElementById('descRapido').value || '').trim().toUpperCase();
      let qtd = Number(document.getElementById('qtdRapido').value) || 1;
      let unit = parseFloat(String(document.getElementById('valorUnitRapido').value).replace(',', '.')) || 0;
      let valFinal = parseFloat(String(document.getElementById('valorTotalRapido').value).replace(',', '.')) || (qtd * unit);
      valFinal = Math.round(valFinal * 100) / 100;

      if(!desc) {
          document.getElementById('descRapido').focus();
          return Swal.fire({toast: true, position: 'top-end', icon: 'warning', title: 'Preencha a descrição da peça.', timer: 2500, showConfirmButton: false});
      }
      if(valFinal <= 0) {
          document.getElementById('valorUnitRapido').focus();
          return Swal.fire({toast: true, position: 'top-end', icon: 'warning', title: 'Informe o valor da peça.', timer: 2500, showConfirmButton: false});
      }

      let item = { 
          desc: desc, 
          qtd: qtd, 
          valor: valFinal, 
          data: document.getElementById('dataRapido').value || new Date().toISOString().split('T')[0], 
          venc: document.getElementById('vencRapido').value || "", 
          pago: false, pagoValor: 0, img: null 
      };

      let btn = document.getElementById('btnConfirmarLancamentoRapido');
      if (btn) btn.disabled = true;

      db.collection("clientes").doc(id).update({
          itens: firebase.firestore.FieldValue.arrayUnion(item)
      }).then(() => {
          Swal.fire({icon: 'success', title: 'Lançado com sucesso!', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false});
          fecharModalRapido();
      }).catch(err => {
          console.error("Erro ao lançar item:", err);
          Swal.fire('Erro', 'Não foi possível salvar o lançamento: ' + err.message, 'error');
      }).finally(() => {
          if (btn) btn.disabled = false;
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

  function preencherValorCatEditar() {
      let t = (document.getElementById('editDesc').value || '').trim().toUpperCase();
      let a = catalogo.find(c => c.nome.toUpperCase() === t);
      if(a) { 
          document.getElementById('editValorUnit').value = Number(a.valor).toFixed(2);
          calcularTotalEditar();
      }
  }

  function calcularTotalEditar() {
      let qtd = Number(document.getElementById('editQtd').value) || 0;
      let unit = parseFloat(String(document.getElementById('editValorUnit').value).replace(',', '.')) || 0;
      let total = Math.round(qtd * unit * 100) / 100;
      document.getElementById('editValor').value = total > 0 ? total.toFixed(2) : (unit > 0 ? unit.toFixed(2) : '');
  }

  function tratarEnterEditar(e, campo) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (campo === 'desc') {
          preencherValorCatEditar();
          let inQtd = document.getElementById('editQtd');
          if (inQtd) { inQtd.focus(); if (inQtd.select) inQtd.select(); }
      } else if (campo === 'qtd') {
          calcularTotalEditar();
          let inUnit = document.getElementById('editValorUnit');
          if (inUnit) { inUnit.focus(); if (inUnit.select) inUnit.select(); }
      } else if (campo === 'unit') {
          calcularTotalEditar();
          salvarEdicao();
      } else if (campo === 'data') {
          let inVenc = document.getElementById('editVenc');
          if (inVenc) inVenc.focus();
      } else if (campo === 'venc') {
          salvarEdicao();
      }
  }

  function abrirEditar(id, ii) {
      let c = clientes.find(x => x.id === id);
      if (!c || !c.itens || !c.itens[ii]) return;
      let i = c.itens[ii];
      editRef = { id, ii };

      let qtd = Number(i.qtd) || 1;
      let total = Number(i.valor) || 0;
      let unit = qtd > 0 ? (total / qtd) : total;

      document.getElementById('editDesc').value = i.desc || "";
      document.getElementById('editQtd').value = qtd;
      document.getElementById('editValorUnit').value = unit > 0 ? unit.toFixed(2) : '';
      document.getElementById('editValor').value = total > 0 ? total.toFixed(2) : '';
      document.getElementById('editData').value = i.data || "";
      document.getElementById('editVenc').value = i.venc || "";

      document.getElementById('editModal').style.display = 'flex';
      setTimeout(() => {
          let el = document.getElementById('editValorUnit') || document.getElementById('editDesc');
          if (el) {
              el.focus();
              if (el.select) el.select();
          }
      }, 100);
  }

  function salvarEdicao() {
      if (!editRef) return;
      let { id, ii } = editRef;
      let c = clientes.find(x => x.id === id);
      if (!c || !c.itens || !c.itens[ii]) return;
      let itens = [...c.itens];

      calcularTotalEditar();

      let desc = (document.getElementById('editDesc').value || '').trim().toUpperCase();
      let qtd = Number(document.getElementById('editQtd').value) || 1;
      let unit = parseFloat(String(document.getElementById('editValorUnit').value).replace(',', '.')) || 0;
      let total = parseFloat(String(document.getElementById('editValor').value).replace(',', '.')) || (qtd * unit);
      total = Math.round(total * 100) / 100;

      if (!desc) {
          document.getElementById('editDesc').focus();
          return Swal.fire({toast: true, position: 'top-end', icon: 'warning', title: 'Preencha a descrição da peça.', timer: 2500, showConfirmButton: false});
      }
      if (total <= 0) {
          document.getElementById('editValorUnit').focus();
          return Swal.fire({toast: true, position: 'top-end', icon: 'warning', title: 'Informe o valor da peça.', timer: 2500, showConfirmButton: false});
      }

      itens[ii].desc = desc;
      itens[ii].qtd = qtd;
      itens[ii].valor = total;
      itens[ii].data = document.getElementById('editData').value || itens[ii].data || "";
      itens[ii].venc = document.getElementById('editVenc').value || "";

      let pagoValor = Number(itens[ii].pagoValor) || 0;
      if (pagoValor >= total && total > 0) {
          itens[ii].pagoValor = total;
          itens[ii].pago = true;
      } else {
          itens[ii].pago = false;
      }

      let btn = document.getElementById('btnSalvarEdicao');
      if (btn) btn.disabled = true;

      db.collection("clientes").doc(id).update({ itens }).then(() => {
          Swal.fire({icon: 'success', title: 'Item atualizado com sucesso!', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false});
          fecharModal();
      }).catch(err => {
          console.error("Erro ao atualizar item:", err);
          Swal.fire('Erro', 'Não foi possível salvar a alteração: ' + err.message, 'error');
      }).finally(() => {
          if (btn) btn.disabled = false;
      });
  }

  function fecharModal() {
      document.getElementById('editModal').style.display = 'none';
  }

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

