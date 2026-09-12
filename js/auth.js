// ═══════════════════════════════════════
// 🔹 AUTENTICAÇÃO — LOGIN, CADASTRO E RECUPERAÇÃO
// ═══════════════════════════════════════
// Todas as funções de autenticação ficam neste arquivo.
// Usa `sb` (declarado em supabase.js) e `MODO_DEV`/`DEV_USER`
// (declarados em app.js). Isso funciona porque estas funções
// só são chamadas DEPOIS que todos os arquivos carregam
// (via onclick ou pela IIFE de inicialização).

// autenticação,login,criar conta,esqueceu a senha
function switchAuthTab(tab)
{
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('auth-login').style.display=tab==='login'?'block':'none';
  document.getElementById('auth-signup').style.display=tab==='signup'?'block':'none';
  document.getElementById('auth-forgot').style.display='none';
  document.getElementById('auth-err').classList.remove('visible');
}

//processo de esqueceu a senha
function showForgot()
{
  document.getElementById('auth-login').style.display='none';
  document.getElementById('auth-signup').style.display='none';
  document.getElementById('auth-forgot').style.display='block';
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('auth-err').classList.remove('visible');
  const email=document.getElementById('login-email').value.trim();
  if(email) document.getElementById('forgot-email').value=email;
}
//volta para login, após esqueceu a senha
function showLogin()
{
  document.getElementById('auth-forgot').style.display='none';
  document.getElementById('auth-login').style.display='block';
  document.querySelectorAll('.auth-tab').forEach((t,i)=>{if(i===0)t.classList.add('active')});
  document.getElementById('auth-err').classList.remove('visible');
}
//msg de erro na tela
function showAuthErr(msg){const el=document.getElementById('auth-err');el.textContent=msg;el.classList.add('visible')}
// login
async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;

  // ── MODO DEV: pula login no localhost ──
  if(MODO_DEV){
    console.log('🛠️ [DEV] Login bypassed — entrando como usuário de teste');
    currentUser = DEV_USER;
    document.getElementById('user-email-display').textContent = DEV_USER.email + ' (DEV)';
    document.getElementById('auth-screen').classList.remove('visible');
    document.getElementById('main-app').classList.add('visible');
    await loadAllData();
    return;
  }
  //email e senha vazios
  if(!email||!pass){ showAuthErr('Preencha email e senha.'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled=true; btn.textContent='Entrando...';
  // Limpa APENAS o token local sem chamar o servidor
  // (evita erro de CORS no localhost e conflito de sessão)
  try { localStorage.removeItem('fin-auth-token'); } catch(_){}

  const {data, error} = await sb.auth.signInWithPassword({email, password:pass});

    btn.disabled=false;
  btn.textContent='Entrar';

  if(error){
    // Se o login der erro, coloque no Console informações que me ajudem a descobrir o que aconteceu
    console.group('🔴 [Login] Erro de autenticação');
    console.log('Mensagem:', error.message);
    console.log('Status:', error.status);
    console.log('Código:', error.code || 'N/A');
    console.log('Email usado:', email);
    console.groupEnd();

    // Mensagens de erro específicas baseadas no retorno do Supabase
    let msg = 'Erro ao entrar. Tente novamente.';

    if(error.message?.includes('Invalid login credentials')){
      msg = 'Email ou senha incorretos.';
    } else if(error.message?.includes('Email not confirmed')){
      msg = 'Email não confirmado. Verifique sua caixa de entrada.';
    } else if(error.message?.includes('Too many requests')){
      msg = 'Muitas tentativas. Aguarde alguns minutos.';
    } else if(error.message?.includes('Network') || error.status === 0){
      msg = 'Sem conexão com a internet. Verifique sua rede.';
    } else {
      msg = 'Erro: ' + error.message;
    }

    showAuthErr(msg);
    return;
  }

  // Login OK — log de sucesso
  console.log('✅ [Login] Bem-vindo,', data.user?.email);
}

// REALIZA O CADASTRO DE UM NOVO USUÁRIO E VALIDA OS DADOS INFORMADOS
async function doSignup(){
  const email=document.getElementById('signup-email').value.trim();
  const pass=document.getElementById('signup-pass').value;
  const pass2=document.getElementById('signup-pass2').value;
  if(!email||!pass){showAuthErr('Preencha todos os campos.');return}
  if(pass.length<6){showAuthErr('Senha deve ter ao menos 6 caracteres.');return}
  if(pass!==pass2){showAuthErr('As senhas não coincidem.');return}
  const btn=document.getElementById('btn-signup');btn.disabled=true;btn.textContent='Criando...';
  const {error}=await sb.auth.signUp({email,password:pass});
  btn.disabled=false;btn.textContent='Criar conta';
  if(error){showAuthErr('Erro: '+error.message);return}
  showToast('Conta criada! Verifique seu email.');
}

// REALIZA A RECUPERAÇÃO DE SENHA, ENVIANDO UM EMAIL PARA O USUÁRIO
async function doForgot(){
  const email=document.getElementById('forgot-email').value.trim();
  if(!email){showAuthErr('Digite seu e-mail.');return}
  const btn=document.getElementById('btn-forgot');btn.disabled=true;btn.textContent='Enviando...';
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:'https://minhafinancia.netlify.app/atualizar-senha.html'});
  btn.disabled=false;btn.textContent='Enviar e-mail de recuperação';
  if(error){showAuthErr('Erro: '+error.message);return}
  showToast('E-mail enviado! Verifique sua caixa de entrada.');
  setTimeout(()=>showLogin(),2000);
}

// REALIZA O LOGOUT E LIMPA OS DADOS DA SESSÃO ATUAL
async function doLogout(){
  await sb.auth.signOut();
  gastos=[];patroes=[];diasTrabalhados=[];pagamentos=[];activeWorker=null;
  document.getElementById('main-app').classList.remove('visible');
  document.getElementById('auth-screen').classList.add('visible');
}