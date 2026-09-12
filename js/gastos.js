// ═══════════════════════════════════════
// 🔹 GASTOS — CICLO, MÉTRICAS, GRÁFICOS E LISTA
// ═══════════════════════════════════════
// Concentra tudo sobre gastos: o cálculo do ciclo financeiro,
// as métricas dos cards, os gráficos (Chart.js), a lista de
// lançamentos e o cadastro/edição/exclusão de gastos.
//
// Depende de: `supabase.js` (sb), `app.js` (MONTHS, CAT_*,
// fmtBRL, fmtDate, showToast, estados globais: gastos, cfg,
// cycleRef, chartBar, chartDonut).

// ── CICLO ──

// ── IDENTIFICA QUAL É O CICLO FINANCEIRO ATUAL ──
function detectCurrentCycle(){ 
  const d=now.getDate(),y=now.getFullYear(),m=now.getMonth(); 
  if(d>=cfg.cycleDay) return{year:y,month:m}; 
  return m===0?{year:y-1,month:11}:{year:y,month:m-1}; 
}

// ── DEFINE A DATA DE INÍCIO DO CICLO ──
function cycleStart(y,m){
  return new Date(y,m,cfg.cycleDay)
}

// ── DEFINE A DATA DE TÉRMINO DO CICLO ──
function cycleEnd(y,m){
  const s=cycleStart(y,m);
  return new Date(s.getFullYear(),s.getMonth()+1,cfg.cycleDay-1,23,59,59)
}

// ── CALCULA QUANTOS DIAS POSSUI O CICLO ──
function cycleDays(y,m){
  return Math.round((cycleEnd(y,m)-cycleStart(y,m))/(1000*60*60*24))+1
}

// ── MONTA O TEXTO DO PERÍODO DO CICLO ──
function cycleLabelStr(y,m){
  const s=cycleStart(y,m),e=cycleEnd(y,m);
  const fmt=d=>String(d.getDate()).padStart(2,'0')+' '+MONTHS[d.getMonth()].substring(0,3)+'. '+d.getFullYear();
  return fmt(s)+' → '+fmt(e); 
}

// ── FILTRA OS GASTOS QUE PERTENCEM AO CICLO INFORMADO ──
function gastosDoCiclo(y,m){
  const s=cycleStart(y,m),e=cycleEnd(y,m);
  return gastos.filter(g=>{
    const d=new Date(g.data+'T12:00:00');
    return d>=s&&d<=e;
  }).map(g=>({...g, valor:Number(g.valor)})); // garante que valor é sempre número
}

// ── FILTRA OS DIAS TRABALHADOS DENTRO DO CICLO INFORMADO ──
function diasTrabalhadosDoCiclo(y, m){
  const s = cycleStart(y, m);
  const e = cycleEnd(y, m);
  return diasTrabalhados.filter(d => {
    const dt = new Date(d.data + 'T12:00:00');
    return dt >= s && dt <= e;
  });
}

// ── MÉTRICAS + GRÁFICOS ──

// ── ATUALIZA OS CARDS DE MÉTRICAS FINANCEIRAS ──
function renderMetrics(items){
  // ── CARD 1: TOTAL RECEBIDO ──
  // Soma pagamentos dados baixa no ciclo + dias pendentes ainda não pagos
  const s = cycleStart(cycleRef.year, cycleRef.month);
  const e = cycleEnd(cycleRef.year, cycleRef.month);

  // Pagamentos confirmados (baixa dada) — filtra pelo INÍCIO do ciclo
  // que está gravado no registro, não pela data do pagamento
  const sStr = s.toISOString().split('T')[0];
  const eStr = e.toISOString().split('T')[0];

  const pagsCiclo = pagamentos.filter(p => {
    // ciclo_inicio gravado no momento da baixa deve estar dentro do ciclo consultado
    return p.ciclo_inicio >= sStr && p.ciclo_inicio <= eStr;
  });

  const totalPago = pagsCiclo.reduce((acc, p) => acc + Number(p.valor), 0);

  // Dias trabalhados pendentes (ainda não foram dados baixa) no ciclo
  const diasCiclo = diasTrabalhadosDoCiclo(cycleRef.year, cycleRef.month);
  const totalPendente = diasCiclo.reduce((acc, d) => acc + Number(d.valor), 0);
  const totalRecebido = totalPago + totalPendente;
  const qtdDias = diasCiclo.length + pagsCiclo.reduce((acc,p)=>acc+Number(p.dias_count||0),0);

  document.getElementById('metric-recebido').textContent = fmtBRL(totalRecebido);
  document.getElementById('metric-dias-trabalho').textContent =
    qtdDias + ' dia' + (qtdDias !== 1 ? 's' : '') + ' de trabalho';

  // ── CARD 2: TOTAL GASTO + COMPARATIVO ──
  const totalGasto = items.reduce((s, g) => s + Number(g.valor), 0);
  document.getElementById('metric-total').textContent = fmtBRL(totalGasto);

  let mesAnt = cycleRef.month - 1, anoAnt = cycleRef.year;
  if(mesAnt < 0){ mesAnt = 11; anoAnt--; }

  const itensAnt = gastosDoCiclo(anoAnt, mesAnt);
  const totalAnt = itensAnt.reduce((s, g) => s + Number(g.valor), 0);

  let vsLabel = '— sem ciclo anterior';

  if(totalAnt > 0){
    const diff = ((totalGasto - totalAnt) / totalAnt) * 100;
    const abs = Math.abs(diff).toFixed(0);

    if(diff < -1) vsLabel = '📉 ' + abs + '% menor que o ciclo anterior';
    else if(diff > 1) vsLabel = '📈 ' + abs + '% maior que o ciclo anterior';
    else vsLabel = '➡️ Similar ao ciclo anterior';

  } else if(totalGasto > 0){
    vsLabel = 'Primeiro registro neste ciclo';
  }

  document.getElementById('metric-vs-anterior').textContent = vsLabel;

  // ── CARD 3: SALDO ──
  const saldo = totalRecebido - totalGasto;
  const saldoEl = document.getElementById('metric-saldo');
  const saldoIconEl = document.getElementById('metric-saldo-icon');
  const saldoStatusEl = document.getElementById('metric-saldo-status');

  // Se não há nenhum recebimento cadastrado, não mostra prejuízo — mostra neutro
  const semRecebimentos = totalRecebido === 0;

  if(semRecebimentos && totalGasto > 0){
    saldoEl.className = 'mcard-val';
    saldoEl.textContent = '—';
    saldoIconEl.style.background = 'var(--bg4)';
    saldoIconEl.style.color = 'var(--text3)';
    saldoIconEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    saldoStatusEl.textContent = 'Registre dias trabalhados';

  } else if(saldo >= 0){
    saldoEl.className = 'mcard-val green';
    saldoEl.textContent = fmtBRL(saldo);
    saldoIconEl.style.background = 'var(--green-bg)';
    saldoIconEl.style.color = 'var(--green)';
    saldoIconEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';
    saldoStatusEl.textContent = saldo === 0 ? 'No limite do orçamento' : '🟢 Você está no azul!';

  } else {
    saldoEl.className = 'mcard-val red';
    saldoEl.textContent = '- ' + fmtBRL(Math.abs(saldo));
    saldoIconEl.style.background = 'var(--red-bg)';
    saldoIconEl.style.color = 'var(--red)';
    saldoIconEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>';
    saldoStatusEl.textContent = '🔴 Gastos acima dos ganhos';
  }
}

// ── GERA E ATUALIZA OS GRÁFICOS DE GASTOS ──
function renderCharts(items){
  // ── DONUT por categoria ──
  const catMap={};
  items.forEach(g=>{catMap[g.categoria]=(catMap[g.categoria]||0)+Number(g.valor)});
  const catLabels=Object.keys(catMap);
  const catVals=catLabels.map(k=>catMap[k]);
  if(chartDonut) chartDonut.destroy();
  const ctxD=document.getElementById('chart-donut').getContext('2d');
  chartDonut=new Chart(ctxD,{
    type:'doughnut',
    data:{labels:catLabels,datasets:[{data:catVals,backgroundColor:CAT_COLORS.slice(0,catLabels.length),borderWidth:2,borderColor:'#181c27',hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.label+': '+fmtBRL(ctx.raw)}}},cutout:'62%'}
  });

  // ── BAR: últimos 6 ciclos ──
  const barLabels=[],barVals=[];
  for(let i=5;i>=0;i--){
    let m=cycleRef.month-i,y=cycleRef.year;
    while(m<0){m+=12;y--}
    const its=gastosDoCiclo(y,m);
    const s=cycleStart(y,m);
    barLabels.push(MONTHS_SHORT[s.getMonth()]+'/'+String(s.getFullYear()).slice(2));
    barVals.push(its.reduce((s,g)=>s+Number(g.valor),0));
  }
  if(chartBar) chartBar.destroy();
  const ctxB=document.getElementById('chart-bar').getContext('2d');
  chartBar=new Chart(ctxB,{
    type:'bar',
    data:{labels:barLabels,datasets:[{label:'Total gasto',data:barVals,backgroundColor:barVals.map((_,i)=>i===5?'rgba(99,102,241,0.85)':'rgba(99,102,241,0.35)'),borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtBRL(ctx.raw)}}},
      scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#545870',font:{size:11}}},
               y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#545870',font:{size:11},callback:v=>'R$'+v}}}}
  });
}

// ── RENDERIZA A LISTA DE GASTOS DO CICLO ATUAL ──
function renderExpenses(){
  document.getElementById('cycle-label').textContent=cycleLabelStr(cycleRef.year,cycleRef.month);
  const allInCycle=gastosDoCiclo(cycleRef.year,cycleRef.month);
  renderMetrics(allInCycle);
  renderCharts(allInCycle);

  const search=(document.getElementById('search-input').value||'').toLowerCase();
  const filterCat=document.getElementById('filter-cat').value;
  let items=allInCycle
    .filter(g=>!filterCat||g.categoria===filterCat)
    .filter(g=>!search||g.nome.toLowerCase().includes(search)||g.categoria.toLowerCase().includes(search))
    .sort((a,b)=>{
      const dataDiff = b.data.localeCompare(a.data);
      if(dataDiff !== 0) return dataDiff;
      // Desempate: created_at se existir, senão id
      const aTime = a.created_at || a.id || '';
      const bTime = b.created_at || b.id || '';
      return bTime.localeCompare(aTime);
    });

  document.getElementById('list-badge').textContent=items.length;
  const list=document.getElementById('expense-list');
  if(!items.length){
    list.innerHTML=`<div class="empty-msg"><div class="empty-icon">🧾</div>${search||filterCat?'Nenhum resultado para a busca.':'Nenhum gasto registrado<br>neste ciclo ainda.'}</div>`;
    return;
  }
  list.innerHTML=items.map(g=>`
    <div class="exp-item">
      <div class="exp-icon">${CAT_ICONS[g.categoria]||'📌'}</div>
      <div class="exp-info">
        <div class="exp-name">${g.nome}</div>
        <div class="exp-meta">${g.categoria} · ${fmtDate(g.data)}</div>
      </div>
      <div class="exp-right">
        <div class="exp-val">${fmtBRL(g.valor)}</div>
        <button class="icon-btn edit" onclick="openEdit('${g.id}')" title="Editar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn del" onclick="delExpense('${g.id}')" title="Excluir">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

// ── ALTERA O CICLO EXIBIDO NA LISTA DE GASTOS ──
function changeExpCycle(d){
  cycleRef.month+=d;
  if(cycleRef.month<0){cycleRef.month=11;cycleRef.year--}
  if(cycleRef.month>11){cycleRef.month=0;cycleRef.year++}
  renderExpenses();
}

// ── SELECIONA UMA CATEGORIA DE GASTO ──
function selectCat(btn){
  document.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('selected'));
  btn.classList.add('selected');
}

// ── RETORNA A CATEGORIA DE GASTO SELECIONADA ──
function getSelectedCat(){
  const sel=document.querySelector('#tab-financas .cat-chip.selected');
  return sel?sel.dataset.cat:'Outros';
}

// ── ADICIONA UM NOVO GASTO E SALVA OS DADOS ──
async function addExpense(){

  const nome=document.getElementById('exp-name').value.trim();

  const valor=parseFloat(document.getElementById('exp-val').value);

  const dataInput=document.getElementById('exp-date').value;

  const categoria=getSelectedCat();

  const errEl=document.getElementById('form-err');

  // Validação

  let erros=[];

  if(!nome) erros.push('Descrição obrigatória');

  if(isNaN(valor)||valor<=0) erros.push('Valor inválido');

  if(!dataInput) erros.push('Data obrigatória');

  if(erros.length){

    errEl.textContent='⚠️ '+erros.join(' · ');errEl.classList.add('show');

    document.getElementById('exp-name').classList.toggle('error',!nome);

    document.getElementById('exp-val').classList.toggle('error',isNaN(valor)||valor<=0);

    document.getElementById('exp-date').classList.toggle('error',!dataInput);

    return;

  }

  errEl.classList.remove('show');

  document.querySelectorAll('.inp.error').forEach(el=>el.classList.remove('error'));

  const btn=document.getElementById('btn-add-exp');

  btn.disabled=true;btn.textContent='Salvando...';

  // ── MODO DEV: salva no localStorage ──

  if(MODO_DEV){

    const row = {

      id: 'dev-'+Date.now(),

      nome, categoria, valor,

      data: dataInput,

      user_id: DEV_USER.id,

      created_at: new Date().toISOString()

    };

    gastos.unshift(row);

    saveOfflineCache(gastos, patroes, diasTrabalhados);

    btn.disabled=false; btn.textContent='+ Adicionar gasto';

    document.getElementById('exp-name').value='';

    document.getElementById('exp-val').value='';

    renderExpenses(); showToast('Gasto adicionado! (DEV)');

    return;

  }

  const {data:row,error}=await sb.from('gastos').insert([{nome,categoria,valor,data:dataInput,user_id:currentUser.id}]).select().single();

  btn.disabled=false;btn.textContent='+ Adicionar gasto';

  if(error){

    console.error('❌ Erro ao salvar gasto:', error);

    console.log('user_id usado:', currentUser.id);

    showToast('Erro ao salvar: '+error.message,true);

    return;

  }

  console.log('✅ Gasto salvo com user_id:', currentUser.id);

  gastos.push(row);

  document.getElementById('exp-name').value='';

  document.getElementById('exp-val').value='';

  renderExpenses();showToast('Gasto adicionado!');

}

// ── EXCLUI UM GASTO DO SISTEMA ──
async function delExpense(id){

  if(!confirm('Excluir este gasto? Esta ação não pode ser desfeita.')) return;

  const {error}=await sb.from('gastos').delete().eq('id',id);

  if(error){showToast('Erro ao remover.',true);return}

  gastos=gastos.filter(g=>g.id!==id);
  renderExpenses();
  showToast('Gasto removido.');

}

// ── ABRE O FORMULÁRIO PARA EDITAR UM GASTO EXISTENTE ──
function openEdit(id){
  const g=gastos.find(x=>x.id===id);if(!g)return;
  document.getElementById('edit-id').value=id;
  document.getElementById('edit-nome').value=g.nome;
  document.getElementById('edit-valor').value=g.valor;
  document.getElementById('edit-data').value=g.data;
  document.getElementById('edit-cat').value=g.categoria;
  document.getElementById('modal-edit').classList.add('open');
}

// ── FECHA O FORMULÁRIO DE EDIÇÃO DE GASTO ──
function closeEdit(){document.getElementById('modal-edit').classList.remove('open')}

// ── SALVA AS ALTERAÇÕES DE UM GASTO EXISTENTE ──
async function saveEdit(){
  const id=document.getElementById('edit-id').value;
  const nome=document.getElementById('edit-nome').value.trim();
  const valor=parseFloat(document.getElementById('edit-valor').value);
  const data=document.getElementById('edit-data').value;
  const categoria=document.getElementById('edit-cat').value;
  if(!nome||isNaN(valor)||valor<=0||!data){showToast('Preencha todos os campos.',true);return}
  const {error}=await sb.from('gastos').update({nome,valor,data,categoria}).eq('id',id);
  if(error){showToast('Erro ao editar.',true);return}
  const idx=gastos.findIndex(g=>g.id===id);
  if(idx>-1) gastos[idx]={...gastos[idx],nome,valor,data,categoria};
  closeEdit();renderExpenses();showToast('Gasto atualizado!');
}

// ── CONFIGURAÇÕES ──

// ── EXIBE AS CONFIGURAÇÕES DO CICLO FINANCEIRO ──
function renderCycleConfig(){
  const d=cfg.cycleDay;
  document.getElementById('cycle-day-input').value=d;
  const next=d===1?28:d-1;
  document.getElementById('cycle-badge-info').textContent='Ciclo: dia '+d+' ao dia '+next+' do mês seguinte';
}

// ── SALVA O DIA DE INÍCIO DO CICLO FINANCEIRO ──
async function saveCycleDay(){
  const v=parseInt(document.getElementById('cycle-day-input').value);
  if(isNaN(v)||v<1||v>28){showToast('Digite um dia entre 1 e 28.',true);return}
  cfg.cycleDay=v;
  localStorage.setItem('fin_cfg_'+currentUser.id,JSON.stringify(cfg));
  cycleRef=detectCurrentCycle();
  renderCycleConfig();renderExpenses();
  showToast('Ciclo atualizado para dia '+v+'!');
}