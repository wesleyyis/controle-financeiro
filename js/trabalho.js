// ═══════════════════════════════════════
// 🔹 TRABALHO — PATRÕES E CALENDÁRIO DE DIAS
// ═══════════════════════════════════════
// Concentra os patrões (chips, cadastro, seleção e exclusão)
// e o calendário de dias trabalhados (seleção única/em lote).
//
// Observação de estudo: estas funções não dependem da ordem
// exata dos arquivos, porque `renderWorkerPanel` (que vive em
// pagamentos.js) só é procurada na HORA DA CHAMADA, nunca ao
// carregar este arquivo.

// ── TRABALHO ──

// ── EXIBE OS BOTÕES DOS PATRÕES CADASTRADOS ──
function renderWorkerChips(){
  const el=document.getElementById('worker-chips');
  el.innerHTML=patroes.map((p,i)=>`
    <div style="display:flex;align-items:center;gap:4px">
      <button class="chip${activeWorker===i?' active':''}" onclick="selectWorker(${i})">${p.nome}</button>
      <button class="icon-btn del" onclick="delWorker(${i})" title="Excluir patrão"
        style="width:38px;height:38px;border-radius:99px;border:1px solid rgba(248,113,113,0.25);background:var(--red-bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--red)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`).join('')+
    `<button class="chip-add" onclick="addWorker()">+ Patrão</button>`;
}

// ── CADASTRA UM NOVO PATRÃO ──
async function addWorker(){
  const nome=prompt('Nome do patrão / pessoa para quem trabalha:');
  if(!nome||!nome.trim())return;
  const {data:row,error}=await sb.from('patroes').insert([{nome:nome.trim(),user_id:currentUser.id}]).select().single();
  if(error){showToast('Erro ao salvar patrão.',true);return}
  patroes.push(row);renderWorkerChips();
}

// ── SELECIONA O PATRÃO ATIVO ──
function selectWorker(i){activeWorker=i;renderWorkerChips();renderWorkerPanel()}

// ── EXCLUI UM PATRÃO E OS DIAS TRABALHADOS ASSOCIADOS ──
async function delWorker(i){
  const patrao=patroes[i];
  if(!confirm(`Tem certeza que deseja excluir "${patrao.nome}"?\n\nIsso apagará também todos os dias trabalhados registrados para ele.`)) return;
  // Deleta dias trabalhados do patrão
  const {error:errDias}=await sb.from('dias_trabalhados').delete().eq('user_id',currentUser.id).eq('patrao',patrao.nome);
  if(errDias){showToast('Erro ao remover dias do patrão.',true);return}
  // Deleta o patrão
  const {error:errPatrao}=await sb.from('patroes').delete().eq('id',patrao.id);
  if(errPatrao){showToast('Erro ao remover patrão.',true);return}
  // Atualiza estado local
  diasTrabalhados=diasTrabalhados.filter(d=>d.patrao!==patrao.nome);
  patroes.splice(i,1);
  // Ajusta seleção
  if(patroes.length===0){
    activeWorker=null;
  } else {
    activeWorker=Math.min(i,patroes.length-1);
  }
  renderWorkerChips();
  renderWorkerPanel();
  showToast(`Patrão "${patrao.nome}" excluído.`);
}

// ── CALENDÁRIO ──

// ── CONTROLA O ESTADO DO CALENDÁRIO ──
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelected = new Set();
let calMode = 'calendar';

// ── GERA UMA CHAVE DE DATA NO FORMATO YYYY-MM-DD ──
function calDateKey(y,m,d){ return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0') }

// ── RETORNA A DATA DE HOJE NO FORMATO DO CALENDÁRIO ──
function todayKey(){ const n=new Date(); return calDateKey(n.getFullYear(),n.getMonth(),n.getDate()) }

// ── MONTA E ATUALIZA O CALENDÁRIO ──
function renderCalendar(){
  const patrao = patroes[activeWorker];
  const jaRegistrados = new Set(
    diasTrabalhados.filter(d=>d.patrao===patrao.nome).map(d=>d.data)
  );
  const hoje = todayKey();
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const primeiroDia = new Date(calYear, calMonth, 1).getDay();
  const ultimoDia = new Date(calYear, calMonth+1, 0).getDate();
  const ultimoMesAnt = new Date(calYear, calMonth, 0).getDate();

  // Atualiza título
  const titleEl = document.getElementById('cal-title');
  if(titleEl) titleEl.textContent = MESES[calMonth]+' '+calYear;

  // Gera células
  let cells = '';
  // Dias do mês anterior
  for(let i=primeiroDia-1; i>=0; i--){
    cells += `<div class="cal-day other-month">${ultimoMesAnt-i}</div>`;
  }
  // Dias do mês atual
  for(let d=1; d<=ultimoDia; d++){
    const key = calDateKey(calYear, calMonth, d);
    const isToday = key === hoje;
    const isSelected = calSelected.has(key);
    const hasWork = jaRegistrados.has(key);
    let cls = 'cal-day';
    if(isToday) cls += ' today';
    if(isSelected) cls += ' selected';
    if(hasWork) cls += ' has-work';
    cells += `<div class="${cls}" onclick="calToggleDay('${key}')">${d}</div>`;
  }
  // Completa última linha
  const total = primeiroDia + ultimoDia;
  const resto = total % 7 === 0 ? 0 : 7 - (total % 7);
  for(let i=1; i<=resto; i++){
    cells += `<div class="cal-day other-month">${i}</div>`;
  }

  const gridEl = document.getElementById('cal-grid');
  if(gridEl) gridEl.innerHTML = cells;

  // Atualiza painel de lote
  updateBatchPanel();
}

// ── SELECIONA OU DESSELECIONA UM DIA DO CALENDÁRIO ──
function calToggleDay(key){
  if(calSelected.has(key)){
    calSelected.delete(key);
  } else {
    calSelected.add(key);
  }
  renderCalendar();
}

// ── MUDA O MÊS EXIBIDO NO CALENDÁRIO ──
function calChangeMonth(d){
  calMonth += d;
  if(calMonth < 0){ calMonth=11; calYear--; }
  if(calMonth > 11){ calMonth=0; calYear++; }
  renderCalendar();
}

// ── ATUALIZA O PAINEL DE SELEÇÃO EM LOTE ──
function updateBatchPanel(){
  const countEl = document.getElementById('cal-count');
  const totalEl = document.getElementById('cal-total');
  const saveBtn = document.getElementById('btn-cal-save');
  const valEl = document.getElementById('cal-val');
  if(!countEl) return;

  const n = calSelected.size;
  const val = parseFloat(valEl?.value)||0;

  countEl.textContent = n+' dia'+(n!==1?'s':'')+' selecionado'+(n!==1?'s':'');
  totalEl.textContent = val>0 ? '= '+fmtBRL(n*val) : '';

  if(saveBtn) saveBtn.disabled = n===0;
}

// ── LIMPA TODOS OS DIAS SELECIONADOS ──
function calClearSelection(){
  calSelected.clear();
  renderCalendar();
}

// ── SALVA VÁRIOS DIAS TRABALHADOS DE UMA VEZ ──
async function salvarDiasEmLote(){
  const valor = parseFloat(document.getElementById('cal-val').value);

  if(isNaN(valor)||valor<=0){
    showToast('Digite o valor da diária.',true);
    return;
  }

  if(calSelected.size===0){
    showToast('Selecione pelo menos um dia.',true);
    return;
  }

  const patrao = patroes[activeWorker].nome;
  const uid = currentUser.id;

  // Filtra dias que já existem para não duplicar
  const jaRegistrados = new Set(
    diasTrabalhados.filter(d=>d.patrao===patrao).map(d=>d.data)
  );

  const novos = [...calSelected].filter(d=>!jaRegistrados.has(d));
  const duplicados = calSelected.size - novos.length;

  if(novos.length===0){
    showToast('Todos os dias selecionados já estão registrados.',true);
    return;
  }

  const btn = document.getElementById('btn-cal-save');
  btn.disabled=true;
  btn.textContent='Salvando...';

  const rows = novos.map(data=>({
    patrao,
    data,
    valor,
    user_id: uid
  }));

  const {data:inserted, error} = await sb
    .from('dias_trabalhados')
    .insert(rows)
    .select();

  btn.disabled=false;
  btn.textContent=`💾 Salvar ${calSelected.size} dias`;

  if(error){
    showToast('Erro ao salvar dias.',true);
    console.error(error);
    return;
  }

  diasTrabalhados.push(...(inserted||[]));
  calSelected.clear();

  let msg = `${novos.length} dia${novos.length!==1?'s':''} registrado${novos.length!==1?'s':''}!`;

  if(duplicados>0){
    msg += ` (${duplicados} já existiam, ignorados)`;
  }

  showToast(msg);
  renderWorkerPanel();

  // Atualiza cards do dashboard com novo Total Recebido
  renderExpenses();
}

// ── ALTERA O MODO DO CALENDÁRIO ──
function setCalMode(mode){
  calMode=mode;
  calSelected.clear();
  renderWorkerPanel();
}

// ── REGISTRA UM NOVO DIA DE TRABALHO ──
async function addWorkDay(){
  const dataVal=document.getElementById('work-date').value;
  const valor=parseFloat(document.getElementById('work-val').value);

  if(!dataVal||isNaN(valor)||valor<=0){
    showToast('Preencha a data e o valor.',true);
    return;
  }

  const patrao=patroes[activeWorker].nome;

  // Verifica duplicidade
  const jaTem=diasTrabalhados.some(d=>d.patrao===patrao&&d.data===dataVal);
  if(jaTem){
    showToast('Este dia já está registrado para este patrão.',true);
    return;
  }

  const btn=document.getElementById('btn-add-work');
  btn.disabled=true;
  btn.textContent='Salvando...';

  const {data:row,error}=await sb.from('dias_trabalhados')
    .insert([{patrao,data:dataVal,valor,user_id:currentUser.id}])
    .select()
    .single();

  btn.disabled=false;
  btn.textContent='+ Registrar';

  if(error){
    showToast('Erro ao salvar dia.',true);
    return;
  }

  diasTrabalhados.push(row);
  document.getElementById('work-val').value='';
  renderWorkerPanel();

  // Atualiza cards do dashboard com novo Total Recebido
  renderExpenses();
  showToast('Dia registrado!');
}

// ── REMOVE UM DIA DE TRABALHO ──
async function delWorkDay(id){
  if(!confirm('Remover este dia?'))return;

  const {error}=await sb.from('dias_trabalhados').delete().eq('id',id);

  if(error){
    showToast('Erro ao remover.',true);
    return;
  }

  diasTrabalhados=diasTrabalhados.filter(d=>d.id!==id);
  renderWorkerPanel();

  // Atualiza cards do dashboard com novo Total Recebido
  renderExpenses();
}