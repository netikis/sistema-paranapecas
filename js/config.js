'use strict';
/* Parana Pecas — config + estado compartilhado */

var firebaseConfig = window.PARANA_FIREBASE_CONFIG || window.FIREBASE_CONFIG;
if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error('Firebase config ausente. Verifique firebase-config.js');
}
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var auth = firebase.auth();

var clientes = [];
var catalogo = [];
var logoBase64 = localStorage.getItem('logoParana') || '';

var configEmpresas = {
  ativo: 1,
  emp1: { nome: 'PARANÁ PEÇAS - COMÉRCIO DE PEÇAS AUTOMOTIVAS', end: '', tel: '', cnpj: '' },
  emp2: { nome: '', end: '', tel: '', cnpj: '' }
};
var empDados = configEmpresas.emp1;
var currentUserRole = 'func';
var roleSelected = '';
var paginaAtual = 1;
var itensPorPagina = 10;
var unsubscribeClientes = null;
var unsubscribeCatalogo = null;
var unsubscribeEmpresa = null;

var backupClienteId = null;
var backupItens = null;
var undoTimeout = null;
var signId = null;
var editRef = null;

var urlParams = new URLSearchParams(window.location.search);
var clienteIdUrl = urlParams.get('cliente');
if (clienteIdUrl) {
  document.body.classList.add('mode-client');
  var styleClient = document.createElement('style');
  styleClient.innerHTML = '#loginOverlay { display: none !important; }';
  document.head.appendChild(styleClient);
}

