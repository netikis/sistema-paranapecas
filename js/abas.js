'use strict';
/* Parana Pecas — abas laterais (Clientes / Caixa e Relatorios / Configuracoes) */

function abrirAba(idAba) {
  var painel = document.getElementById(idAba);
  if (!painel) return;
  if (currentUserRole !== 'admin' && painel.classList.contains('admin-only')) idAba = 'abaClientes';

  document.querySelectorAll('.aba-painel').forEach(function (p) {
    p.classList.toggle('active', p.id === idAba);
  });
  document.querySelectorAll('.side-tab').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-aba') === idAba);
  });
  window.scrollTo(0, 0);
}
