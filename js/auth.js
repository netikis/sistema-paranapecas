'use strict';
/* Parana Pecas — login / perfil / usuarios */

  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
  .then(() => {
      auth.onAuthStateChanged((user) => {
          if (document.body.classList.contains('mode-client')) return; 
          if (user) {
              db.collection("usuarios").doc(user.uid).get().then((doc) => {
                  let role = (doc.exists) ? doc.data().perfil : 'admin';
                  let nome = (doc.exists) ? doc.data().nome : user.email;
                  currentUserRole = role;
                  if(currentUserRole === 'admin') document.body.classList.remove('role-func'); else document.body.classList.add('role-func');
                  document.getElementById('userDisplay').innerHTML = `👤 ${nome}<br><span style="color:#aaa">${role.toUpperCase()}</span>`;
                  document.getElementById('loginOverlay').style.display = 'none';
                  document.getElementById('searchBox').value = ''; 
                  
                  setTimeout(() => document.getElementById('searchBox').focus(), 300); 

                  iniciarSincronizacao();
              });
          } else {
              pararSincronizacao(); document.getElementById('loginOverlay').style.display = 'flex';
              document.getElementById('senhaInput').value = ''; document.getElementById('emailInput').value = ''; voltarLogin();
          }
      });
  })
  .catch((error) => {
      console.error("Erro na persistencia:", error);
  });


  function selecionarPerfil(role) { roleSelected = role; document.getElementById('step-1').style.display = 'none'; document.getElementById('step-2').style.display = 'block'; let titulo = role === 'admin' ? 'ÁREA ADMINISTRATIVA' : 'ÁREA DE BALCÃO'; document.getElementById('tituloLogin').innerText = titulo; document.getElementById('emailInput').focus(); }
  function voltarLogin() { roleSelected = ''; document.getElementById('step-1').style.display = 'block'; document.getElementById('step-2').style.display = 'none'; document.getElementById('senhaInput').value = ''; }
  function fazerLogin() { const email = document.getElementById('emailInput').value; const pass = document.getElementById('senhaInput').value; const msg = document.getElementById('msgLogin'); document.getElementById('btnLogin').innerText = "Verificando..."; msg.innerText = ""; auth.signInWithEmailAndPassword(email, pass).catch((error) => { document.getElementById('btnLogin').innerText = "ENTRAR"; msg.innerText = "E-mail ou senha incorretos."; }); }
  function logout() { auth.signOut(); }
  function abrirModalUsuario() { document.getElementById('modalUsuario').style.display = 'flex'; }
  function criarUsuario() { const nome = document.getElementById('novoUserNome').value; const email = document.getElementById('novoUserEmail').value; const senha = document.getElementById('novoUserSenha').value; const perfil = document.getElementById('novoUserPerfil').value; if(!email || !senha || !nome) return Swal.fire('Erro', 'Preencha tudo!', 'error'); const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary"); secondaryApp.auth().createUserWithEmailAndPassword(email, senha).then((userCredential) => { return db.collection("usuarios").doc(userCredential.user.uid).set({ nome: nome, email: email, perfil: perfil }); }).then(() => { secondaryApp.auth().signOut(); secondaryApp.delete(); document.getElementById('modalUsuario').style.display = 'none'; document.getElementById('novoUserNome').value = ''; document.getElementById('novoUserEmail').value = ''; document.getElementById('novoUserSenha').value = ''; Swal.fire('Sucesso', 'Usuário criado!', 'success'); }).catch((error) => { Swal.fire('Erro', error.message, 'error'); secondaryApp.delete(); }); }

