// ═══════════════════════════════════════
// 🔹 PAGAMENTOS — BAIXA, HISTÓRICO E PAINEL
// ═══════════════════════════════════════
// Arqui são tratados os pagamentos: dar baixa nos dias
// trabalhados pendentes, remover registros do histórico e
// montar o painel completo do patrão (que combina resumo,
// pendentes, calendário e histórico).
//
// Depende de `trabalho.js` (calMode, calSelected, renderCalendar)
// e `gastos.js` (renderExpenses). Tudo em escopo global.

// ── DÁ BAIXA E CONFIRMA O PAGAMENTO DOS DIAS TRABALHADOS ──
async function darBaixa(patraoNome){
  const diasPendentes = diasTrabalhados.filter(d => d.patrao === patraoNome);
  if(!diasPendentes.length){
    showToast('Nenhum dia pendente para dar baixa.',true);
    return;
  }

  const totalVal = diasPendentes.reduce((s,d)=>s+Number(d.valor),0);
  const qtd = diasPendentes.length;

  if(!confirm(`Confirmar recebimento de ${fmtBRL(totalVal)} referente a ${qtd} dia${qtd!==1?'s':''} trabalhados para ${patraoNome}?\n\nOs dias pendentes serão arquivados e o valor ficará salvo no histórico.`)) return;

  const btn = document.getElementById('btn-baixa-'+patraoNome.replace(/\s/g,'_'));
  if(btn){
    btn.disabled=true;
    btn.textContent='Salvando...';
  }

  const uid = currentUser.id;
  const hoje = new Date().toISOString().split('T')[0];
  const s = cycleStart(cycleRef.year, cycleRef.month).toISOString().split('T')[0];
  const e = cycleEnd(cycleRef.year, cycleRef.month).toISOString().split('T')[0];

  // 1. Grava o pagamento no histórico
  const {data:pag, error:errPag} = await sb.from('pagamentos').insert([{
    user_id: uid,
    patrao: patraoNome,
    valor: totalVal,
    dias_count: qtd,
    data_pagamento: hoje,
    ciclo_inicio: s,
    ciclo_fim: e,
  }]).select().single();

  if(errPag){
    showToast('Erro ao registrar pagamento.',true);
    console.error(errPag);
    return;
  }

  // 2. Deleta os dias pendentes do patrão
  const ids = diasPendentes.map(d=>d.id);
  const {error:errDel} = await sb.from('dias_trabalhados').delete().in('id', ids);

  if(errDel){
    showToast('Pagamento salvo mas erro ao limpar dias.',true);
    console.error(errDel);
  }

  // 3. Atualiza estado local
pagamentos.push(pag);
diasTrabalhados = diasTrabalhados.filter(d => d.patrao !== patraoNome);

// Salva no cache offline
saveOfflineCache(gastos, patroes, diasTrabalhados);

renderWorkerPanel();
renderExpenses();
showToast(`✅ Pagamento de ${fmtBRL(totalVal)} confirmado!`);
}

// ── REMOVE UM REGISTRO DE PAGAMENTO DO HISTÓRICO ──
async function deletarPagamento(id){
  if(!confirm('Remover este registro de pagamento?\n\nOs dias trabalhados NÃO serão restaurados.')) return;

  const {error} = await sb.from('pagamentos').delete().eq('id', id);

  if(error){
    showToast('Erro ao remover.',true);
    return;
  }

  pagamentos = pagamentos.filter(p=>p.id!==id);
  renderWorkerPanel();
  renderExpenses();
  showToast('Pagamento removido.');
}

// ── MONTA O PAINEL DE TRABALHO DO PATRÃO SELECIONADO ──
function renderWorkerPanel(){
  const panel=document.getElementById('worker-panel');

  if(activeWorker===null||activeWorker>=patroes.length){
    panel.innerHTML='<div class="empty-msg"><div class="empty-icon">👷</div>Selecione ou adicione<br>um patrão acima.</div>';
    return;
  }

  const patrao=patroes[activeWorker];
  const pNome=patrao.nome;
  const btnId='btn-baixa-'+pNome.replace(/\s/g,'_');

  // Dias pendentes (ainda não pagos)
  const diasPendentes=diasTrabalhados.filter(d=>d.patrao===pNome).sort((a,b)=>b.data.localeCompare(a.data));
  const totalPendente=diasPendentes.reduce((s,d)=>s+Number(d.valor),0);

  // Histórico de pagamentos do patrão
  const histPatrao=pagamentos.filter(p=>p.patrao===pNome).sort((a,b)=>b.data_pagamento.localeCompare(a.data_pagamento));
  const totalHist=histPatrao.reduce((s,p)=>s+Number(p.valor),0);

  panel.innerHTML=`
    <div class="summary-grid" style="margin-bottom:16px">
      <div class="scard"><div class="scard-label">DIAS PENDENTES</div><div class="scard-val amber" style="color:var(--amber)">${diasPendentes.length}</div></div>
      <div class="scard"><div class="scard-label">TOTAL RECEBIDO</div><div class="scard-val green">${fmtBRL(totalHist)}</div></div>
    </div>

    <!-- CARD PENDENTES + DAR BAIXA -->
    ${diasPendentes.length ? `
    <div class="pendente-card">
      <div class="pendente-header">
        <span class="pendente-title">⏳ AGUARDANDO PAGAMENTO</span>
        <span class="pendente-total">${fmtBRL(totalPendente)}</span>
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:14px">
        ${diasPendentes.length} dia${diasPendentes.length!==1?'s':''} trabalhado${diasPendentes.length!==1?'s':''} — clique em "Dar Baixa" quando ${pNome} te pagar
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;max-height:160px;overflow-y:auto">
        ${diasPendentes.map(d=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg3);border-radius:8px;gap:8px">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtDate(d.data)}</div>
              <div style="font-size:11px;color:var(--text3)">${WDAYS[new Date(d.data+'T12:00:00').getDay()]}</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--amber)">${fmtBRL(d.valor)}</div>
            <button class="icon-btn del" onclick="delWorkDay('${d.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>`).join('')}
      </div>
      <button class="btn-baixa" id="${btnId}" onclick="darBaixa('${pNome}')">
        ✅ Dar Baixa — Recebi ${fmtBRL(totalPendente)}
      </button>
    </div>` : `
    <div style="background:var(--green-bg);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:16px;font-size:13px;color:var(--green);font-weight:600;text-align:center">
      ✅ Nenhum dia pendente — tudo pago!
    </div>`}

    <div class="mode-toggle">
      <button class="mode-btn${calMode==='single'?' active':''}" onclick="setCalMode('single')">📅 Dia único</button>
      <button class="mode-btn${calMode==='calendar'?' active':''}" onclick="setCalMode('calendar')">🗓️ Vários dias</button>
    </div>

    <!-- MODO DIA ÚNICO -->
    <div id="mode-single" style="display:${calMode==='single'?'block':'none'}">
      <div class="add-card">
        <div class="card-title">REGISTRAR DIA TRABALHADO</div>
        <div class="form-stack">
          <input type="date" id="work-date" class="inp">
          <input type="number" id="work-val" class="inp" placeholder="Valor do dia R$" min="0" step="0.01" inputmode="decimal">
          <button class="btn-primary" id="btn-add-work" onclick="addWorkDay()">+ Registrar</button>
        </div>
      </div>
    </div>

        <!-- MODO CALENDÁRIO -->
    <div id="mode-calendar" style="display:${calMode==='calendar'?'block':'none'}">
      <div class="cal-wrap">
        <div class="cal-header">
          <button class="cal-nav" onclick="calChangeMonth(-1)">‹</button>
          <div class="cal-title" id="cal-title">—</div>
          <button class="cal-nav" onclick="calChangeMonth(1)">›</button>
        </div>
        <div class="cal-weekdays">
          <div class="cal-wd">Dom</div><div class="cal-wd">Seg</div><div class="cal-wd">Ter</div>
          <div class="cal-wd">Qua</div><div class="cal-wd">Qui</div><div class="cal-wd">Sex</div>
          <div class="cal-wd">Sáb</div>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
        <div class="cal-batch">
          <div class="cal-batch-info">
            <span class="cal-batch-count" id="cal-count">0 dias selecionados</span>
            <span class="cal-batch-total" id="cal-total"></span>
          </div>
          <div class="cal-batch-row">
            <input type="number" id="cal-val" class="inp" placeholder="Valor da diária R$"
              min="0" step="0.01" inputmode="decimal" oninput="updateBatchPanel()">
            <button class="btn-cal-clear" onclick="calClearSelection()">Limpar</button>
          </div>
          <button class="btn-cal-save" id="btn-cal-save" onclick="salvarDiasEmLote()"
            style="width:100%;margin-top:10px" disabled>
            💾 Salvar dias selecionados
          </button>
        </div>
      </div>
    </div>

    <!-- HISTÓRICO DE PAGAMENTOS -->
    ${histPatrao.length ? `
    <div class="hist-section">
      <div class="hist-section-title">📋 HISTÓRICO DE PAGAMENTOS — ${pNome.toUpperCase()}</div>
      ${histPatrao.map(p=>`
        <div class="hist-item">
          <div class="hist-left">
            <div class="hist-patrao">💰 ${fmtBRL(p.valor)}</div>
            <div class="hist-data">Pago em ${fmtDate(p.data_pagamento)}</div>
            <div class="hist-dias">${p.dias_count} dia${p.dias_count!==1?'s':''} trabalhado${p.dias_count!==1?'s':''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="hist-val">${fmtBRL(p.valor)}</span>
            <button class="hist-del" onclick="deletarPagamento('${p.id}')" title="Remover">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/></svg>
            </button>
          </div>
        </div>`).join('')}
    </div>` : ''}
  `;
    const di=document.getElementById('work-date');

  if(di) di.value=new Date().toISOString().split('T')[0];

  if(calMode==='calendar') renderCalendar();
}