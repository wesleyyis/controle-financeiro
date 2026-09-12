// ═══════════════════════════════════════
// 🔹 APP.JS — NÚCLEO DO SISTEMA (CARREGA POR ÚLTIMO)
// ═══════════════════════════════════════
// Este arquivo é o cérebro do aplicativo. Contém:
//   1. CONFIGURAÇÕES INICIAIS  — Service Worker, modo DEV, offline
//   2. FUNÇÕES AUXILIARES      — fmtBRL, fmtDate, showToast, showTab
//   3. CONSTANTES              — meses, dias, ícones e cores
//   4. ESTADO GLOBAL           — arrays de dados e variáveis do app
//   5. INICIALIZAÇÃO           — IIFE que liga tudo no arranque
//   6. INSTALAÇÃO PWA          — barra "Instalar o app"
//
// ⚠️ Precisa ser o ÚLTIMO <script> do index.html porque contém
// a IIFE que roda IMEDIATAMENTE ao carregar. Todas as funções
// que ela chama (ex.: loadAllData em backup.js) precisam já
// existir — por isso o app.js fica depois dos outros arquivos.

// ═══════════════════════════════════════
// 🔹 CONFIGURAÇÕES INICIAIS
// ═══════════════════════════════════════

// ── REGISTRA SERVICE WORKER (PWA) ──
if('serviceWorker' in navigator)
{
  window.addEventListener('load',()=>
  {
    navigator.serviceWorker.register('/sw.js')
      .then(()=>console.log('PWA: Service Worker ativo!'))
      .catch(err=>console.warn('PWA SW erro:',err));
  });
}

// ── MODO DESENVOLVIMENTO ──
// Detecta automaticamente se está no localhost
// No Netlify (produção) isso nunca ativa
const MODO_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Usuário simulado para testes locais
// NUNCA aparece em produção
const DEV_USER = 
{
  id: 'dev-user-local-test',
  email: 'dev@teste.local'
};
const OFFLINE_KEY_GASTOS      = 'fin_offline_gastos';
const OFFLINE_KEY_PATROES     = 'fin_offline_patroes';
const OFFLINE_KEY_DIAS        = 'fin_offline_dias';
let isOffline = false;

function setOfflineMode(on)
{
  isOffline = on;
  const banner = document.getElementById('offline-banner');
  if(banner) banner.style.display = on ? 'flex' : 'none';
}

function saveOfflineCache(g, p, d)
{
  try {
    localStorage.setItem(OFFLINE_KEY_GASTOS,  JSON.stringify(g));
    localStorage.setItem(OFFLINE_KEY_PATROES, JSON.stringify(p));
    localStorage.setItem(OFFLINE_KEY_DIAS,    JSON.stringify(d));
  } catch(e){ console.warn('Cache offline cheio:', e); }
}

function loadOfflineCache()
{
  try {
    return {
      gastos:           JSON.parse(localStorage.getItem(OFFLINE_KEY_GASTOS)  || '[]'),
      patroes:          JSON.parse(localStorage.getItem(OFFLINE_KEY_PATROES) || '[]'),
      diasTrabalhados:  JSON.parse(localStorage.getItem(OFFLINE_KEY_DIAS)    || '[]'),
    };
  } catch(e){ return {gastos:[],patroes:[],diasTrabalhados:[]}; }
}

// ═══════════════════════════════════════
// 🔹 CONSTANTES
// ═══════════════════════════════════════
//const que nunca muda, mês,dia,ícones e suas cores
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WDAYS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const CAT_ICONS={'Alimentação':'🛒','Transporte':'🚌','Moradia':'🏠','Saúde':'💊','Educação':'📚','Lazer':'🎉','Compras':'🛍️','Contas':'💡','Outros':'📌','Conta/Serviço':'💡','Outro':'📌'};
const CAT_COLORS=['#040574','#22c55e','#ee2b2b','#5b646e','#ffb907','#dd00ff','#1d4d3b8b','#00aaff','#64475f'];

// ═══════════════════════════════════════
// 🔹 ESTADO GLOBAL
// ═══════════════════════════════════════
//let cria variavel que pode mudar,array vazio,
let gastos=[],patroes=[],diasTrabalhados=[],pagamentos=[];
let cfg={cycleDay:1};
let activeWorker=null;
let currentUser=null;
let chartBar=null,chartDonut=null;

//estanciado a data atual,ano e mês
const now=new Date();
let cycleRef={year:now.getFullYear(),month:now.getMonth()};

// ═══════════════════════════════════════
// 🔹 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════

//formata o dinheiro real
function fmtBRL(v){return'R$ '+Number(v).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}

//formata a data , ano e hora
function fmtDate(str){const d=new Date(str+'T12:00:00');return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()}

//mostra uma mensagem rapida na tela
function showToast(msg,err=false)
{
  const el=document.getElementById('toast');
  el.textContent=msg;el.className=err?'err':'';el.style.display='block';
  setTimeout(()=>el.style.display='none',2800);
}

//troca de abas
function showTab(name)
{
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.getElementById('nav-'+name).classList.add('active');
}

// ═══════════════════════════════════════
// 🔹 INICIALIZAÇÃO DO SISTEMA
// ═══════════════════════════════════════
(async()=>{

  // ── MODO DEV: entra direto sem login ──
  if(MODO_DEV){
    console.log('🛠️ [DEV] Modo desenvolvimento ativo — login automático');

    document.getElementById('app-loader').style.display='none';
    currentUser=DEV_USER;
    document.getElementById('user-email-display').textContent=DEV_USER.email+' (DEV)';
    document.getElementById('auth-screen').classList.remove('visible');
    document.getElementById('main-app').classList.add('visible');

    // Mostra badge de desenvolvimento no header
    const h1=document.querySelector('.app-header h1');
    if(h1){
      h1.innerHTML+=' <span style="font-size:11px;background:#92400e;color:#fef3c7;padding:2px 8px;border-radius:99px;font-weight:700;vertical-align:middle">DEV</span>';
    }

    await loadAllData();
    return;
  }

  // ── TENTA RECUPERAR A SESSÃO DO USUÁRIO ──
  let session=null;

  try{
    const timeout=new Promise((_,rej)=>
      setTimeout(()=>rej(new Error('timeout')),5000)
    );

    const {data,error}=await Promise.race([
      sb.auth.getSession(),
      timeout
    ]);

    if(error) throw error;

    session=data?.session || null;

    if(session){
      console.log('✅ [Init] Sessão ativa:',session.user?.email);
    }

  }catch(e){
    console.warn('[Init] getSession falhou:',e.message);

    // Tenta recuperar a sessão diretamente do localStorage
    try{
      const raw=JSON.parse(
        localStorage.getItem('fin-auth-token') || 'null'
      );

      if(raw?.currentSession?.user) session=raw.currentSession;
      else if(raw?.user) session=raw;

    }catch(_){}

    // Se não encontrou uma sessão válida, limpa a chave do app
    if(!session){
      localStorage.removeItem('fin-auth-token');
    }
  }

  document.getElementById('app-loader').style.display='none';

  // ── SE EXISTE SESSÃO: ABRE O SISTEMA ──
  if(session && session.user){
    currentUser=session.user;

    const saved=localStorage.getItem('fin_cfg_'+currentUser.id);
    if(saved) cfg=JSON.parse(saved);

    document.getElementById('user-email-display').textContent=
      currentUser.email || '—';

    document.getElementById('auth-screen').classList.remove('visible');
    document.getElementById('main-app').classList.add('visible');

    await loadAllData();

  }else{
    // ── SEM SESSÃO: MOSTRA A TELA DE LOGIN ──
    if(!navigator.onLine){
      setOfflineMode(true);
    }

    document.getElementById('auth-screen').classList.add('visible');
  }

  // ── DETECTA QUANDO A INTERNET VOLTA ──
  window.addEventListener('online',async()=>{
    if(isOffline && currentUser){
      setOfflineMode(false);
      showToast('Conexão restaurada! Atualizando dados...');
      await loadAllData();
    }
  });

  // ── DETECTA QUANDO FICA SEM INTERNET ──
  window.addEventListener('offline',()=>{
    if(currentUser) setOfflineMode(true);
  });

  // ── MONITORA ALTERAÇÕES DE AUTENTICAÇÃO ──
  sb.auth.onAuthStateChange(async(event,session)=>{

    // Usuário acabou de entrar
    if(event==='SIGNED_IN' && session){
      if(currentUser && currentUser.id===session.user.id) return;

      currentUser=session.user;

      const saved=localStorage.getItem('fin_cfg_'+currentUser.id);
      if(saved) cfg=JSON.parse(saved);

      document.getElementById('user-email-display').textContent=
        currentUser.email;

      document.getElementById('auth-screen').classList.remove('visible');
      document.getElementById('main-app').classList.add('visible');

      await loadAllData();
    }

    // Usuário entrou no fluxo de recuperação de senha
    if(event==='PASSWORD_RECOVERY'){
      document.getElementById('main-app').classList.remove('visible');
      document.getElementById('auth-screen').classList.add('visible');
    }

    // Usuário foi atualizado
    if(event==='USER_UPDATED'){
      await sb.auth.signOut();
    }

    // Usuário saiu
    if(event==='SIGNED_OUT'){
      currentUser=null;
      gastos=[];
      patroes=[];
      diasTrabalhados=[];
      pagamentos=[];
      activeWorker=null;

      setOfflineMode(false);
      localStorage.removeItem('fin-auth-token');

      document.getElementById('main-app').classList.remove('visible');
      document.getElementById('auth-screen').classList.add('visible');
    }

    // Token de acesso foi renovado
    if(event==='TOKEN_REFRESHED' && session){
      currentUser=session.user;
    }
  });
})();

// ═══════════════════════════════════════
// 🔹 INSTALAÇÃO DO APLICATIVO PWA
// ═══════════════════════════════════════

// Controla o aviso de instalação do aplicativo
let deferredPrompt=null;

// Não mostra o aviso se o usuário fechou nos últimos 3 dias
const _pwaFechado=localStorage.getItem('pwa_fechado');
const _pwaBloqueado=_pwaFechado &&
  Date.now()-Number(_pwaFechado)<3*24*60*60*1000;

// Detecta quando o navegador oferece a instalação do PWA
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  if(_pwaBloqueado) return;

  deferredPrompt=e;
  document.getElementById('pwa-install-bar').classList.add('show');
});

// Executa a instalação quando o usuário clica no botão
document.getElementById('pwa-btn-install').addEventListener('click',async()=>{
  if(!deferredPrompt) return;

  deferredPrompt.prompt();

  const {outcome}=await deferredPrompt.userChoice;

  if(outcome==='accepted'){
    document.getElementById('pwa-install-bar').classList.remove('show');
  }

  deferredPrompt=null;
});

// Esconde a barra quando o aplicativo foi instalado
window.addEventListener('appinstalled',()=>{
  document.getElementById('pwa-install-bar').classList.remove('show');
  deferredPrompt=null;
});

// Fecha a barra e salva o horário para não mostrar novamente por 3 dias
function fecharBarraPWA(){
  document.getElementById('pwa-install-bar').classList.remove('show');
  localStorage.setItem('pwa_fechado',Date.now());
}