'use strict';
/* Parana Pecas — empresa / catalogo / logo / backup */

  document.getElementById('logoInput').addEventListener('change', e => { let file = e.target.files[0]; if (!file) return; let reader = new FileReader(); reader.onload = event => { let img = new Image(); img.onload = () => { let canvas = document.createElement('canvas'); let ctx = canvas.getContext('2d'); let maxWidth = 400; let scale = maxWidth / img.width; if (scale > 1) scale = 1; canvas.width = img.width * scale; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); let base64 = canvas.toDataURL('image/jpeg', 0.7); db.collection("config").doc("empresa").set({ logo: base64 }, { merge: true }).then(() => Swal.fire('Sucesso', 'Logo salva!', 'success')).catch(err => Swal.fire('Erro', 'Erro ao salvar: ' + err.message, 'error')); }; img.src = event.target.result; }; reader.readAsDataURL(file); });


  function carregarFormEmpresa() {
      let s = document.getElementById('selectEmpresaConf');
      if (!s) return;
      let idSelected = parseInt(s.value);
      let emp = idSelected === 2 ? configEmpresas.emp2 : configEmpresas.emp1;

      document.getElementById('confEmpNome').value = emp.nome || '';
      document.getElementById('confEmpEnd').value = emp.end || '';
      document.getElementById('confEmpTel').value = emp.tel || '';
      document.getElementById('confEmpCnpj').value = emp.cnpj || '';
      
      // Marca o checkbox se a loja selecionada no menu for a que está ativa no sistema
      document.getElementById('empresaAtivaCheckbox').checked = (configEmpresas.ativo === idSelected);
  }

  // Função nova que salva a loja 1 ou 2 dependendo do menu
  function salvarDadosEmpresa() { 
      let idSelected = document.getElementById('selectEmpresaConf').value;
      let isAtiva = document.getElementById('empresaAtivaCheckbox').checked;

      let novaEmp = {
          nome: document.getElementById('confEmpNome').value,
          end: document.getElementById('confEmpEnd').value,
          tel: document.getElementById('confEmpTel').value,
          cnpj: document.getElementById('confEmpCnpj').value
      };

      let updatePayload = {};
      
      // Salva no bloco correspondente no Firebase
      if (idSelected === '1') updatePayload.emp1 = novaEmp;
      else updatePayload.emp2 = novaEmp;

      // Se marcou a caixinha, define essa loja como a ativa do sistema inteiro
      if (isAtiva) updatePayload.ativo = parseInt(idSelected);

      db.collection("config").doc("empresa").set(updatePayload, {merge: true})
        .then(() => Swal.fire({ icon: 'success', title: 'Salvo!', timer: 1500, showConfirmButton:false })); 
  }

  function apagarCat(id){db.collection("catalogo").doc(id).delete();}


function salvarCatalogo() {
  var n = document.getElementById('catNome').value;
  var v = Number(document.getElementById('catValor').value);
  if (n && v) {
    db.collection('catalogo').add({ nome: n.toUpperCase(), valor: v });
    document.getElementById('catNome').value = '';
    document.getElementById('catValor').value = '';
  }
}

  function fazerBackupLocal() { if(!clientes.length)return Swal.fire('Erro','Vazio','error'); let b=new Blob([JSON.stringify(clientes)],{type:"application/json"}),l=document.createElement("a");l.href=URL.createObjectURL(b);l.download=`backup_${new Date().toISOString().split('T')[0]}.json`;document.body.appendChild(l);l.click();document.body.removeChild(l);Swal.fire('Sucesso','Backup salvo','success'); }
  
  function abrirRestauracao() {
      document.getElementById('inputBackup').click();
  }

  async function processarRestauracao(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];

      const confirm = await Swal.fire({
          title: 'CUIDADO: RESTAURAÇÃO',
          text: 'Você está prestes a enviar os dados deste arquivo para o sistema. Isso atualizará clientes existentes e criará novos. Deseja continuar?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'SIM, RESTAURAR',
          cancelButtonText: 'Cancelar'
      });

      if (!confirm.isConfirmed) {
          input.value = ''; 
          return;
      }

      const reader = new FileReader();
      reader.onload = async function(e) {
          try {
              const dados = JSON.parse(e.target.result);
              if (!Array.isArray(dados)) throw new Error("O arquivo não está no formato correto de backup.");

              Swal.fire({title: 'Restaurando...', html: 'Aguarde enquanto os dados são processados.', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

              let batch = db.batch();
              let count = 0;
              let totalProcessado = 0;

              for (const cliente of dados) {
                  let ref = cliente.id ? db.collection("clientes").doc(cliente.id) : db.collection("clientes").doc();
                  let dataToSave = { ...cliente };
                  delete dataToSave.id; 

                  batch.set(ref, dataToSave, { merge: true });
                  
                  count++;
                  totalProcessado++;

                  if (count >= 450) {
                      await batch.commit();
                      batch = db.batch();
                      count = 0;
                  }
              }

              if (count > 0) {
                  await batch.commit();
              }

              Swal.fire('Sucesso', `Backup restaurado! ${totalProcessado} registros processados.`, 'success');
              input.value = ''; 

          } catch (err) {
              console.error(err);
              Swal.fire('Erro', 'Falha ao restaurar: ' + err.message, 'error');
              input.value = '';
          }
      };
      reader.readAsText(file);
  }


  function migrarDados(){let l=JSON.parse(localStorage.getItem('clientesParana'))||[];l.forEach(c=>db.collection("clientes").add(c));Swal.fire('OK','Sincronizado','success');}

