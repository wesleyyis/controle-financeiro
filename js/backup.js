// ═══════════════════════════════════════
// 🔹 BACKUP — EXPORTAR, IMPORTAR E CARREGAR DADOS
// ═══════════════════════════════════════
// Cuida da persistência completa: exportar backup .json,
// importar/restaurar (substituindo os dados) e a função
// `loadAllData()`, usada na inicialização para puxar tudo
// do Supabase ou do cache offline.

// ── EXPORTA O BACKUP COMPLETO ──
async function exportBackup(){
  // Inclui TUDO: gastos, patroes, dias trabalhados, pagamentos e config
  const bk={
    version:4,
    exportedAt:new Date().toISOString(),
    gastos,
    patroes,
    diasTrabalhados,
    pagamentos,
    cfg
  };

  const blob=new Blob([JSON.stringify(bk,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');

  a.href=url;
  a.download='backup-financas-'+new Date().toISOString().split('T')[0]+'.json';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Backup exportado com sucesso!');
}

// ── IMPORTA UM BACKUP COMPLETO E RESTAURA OS DADOS ──
async function importBackup(input){
  const file=input.files[0];
  if(!file) return;

  const reader=new FileReader();

  reader.onload=async e=>{
    try{
      const bk=JSON.parse(e.target.result);

      if(!confirm('Isso substituirá TODOS os dados atuais pelo backup.\n\nGastos, dias trabalhados, patrões e histórico de pagamentos serão restaurados.\n\nConfirmar?')) return;

      showToast('Importando, aguarde...');
      const uid=currentUser.id;

      // ── 1. GASTOS ──
      await sb.from('gastos').delete().eq('user_id',uid);

      let gastosRows=[];

      if(bk.gastos?.length){
        gastosRows=bk.gastos.map(g=>({
          nome:g.nome || g.name || 'Sem nome',
          categoria:g.categoria || g.cat || 'Outros',
          valor:Number(g.valor || g.val || 0),
          data:g.data || g.date || new Date().toISOString().split('T')[0],
          user_id:uid
        }));
      }else if(bk.expData){
        // Compatibilidade com backup v2 (formato antigo)
        Object.values(bk.expData).forEach(arr=>
          arr.forEach(g=>gastosRows.push({
            nome:g.name,
            categoria:g.cat,
            valor:Number(g.val),
            data:g.date,
            user_id:uid
          }))
        );
      }

      if(gastosRows.length) await sb.from('gastos').insert(gastosRows);

      // ── 2. PATRÕES ──
      await sb.from('patroes').delete().eq('user_id',uid);

      let patraoRows=[];

      if(bk.patroes?.length){
        patraoRows=bk.patroes.map(p=>({
          nome:p.nome,
          user_id:uid
        }));
      }else if(bk.workers?.length){
        // Compatibilidade com backup v2
        patraoRows=bk.workers.map(w=>({
          nome:w,
          user_id:uid
        }));
      }

      if(patraoRows.length) await sb.from('patroes').insert(patraoRows);

      // ── 3. DIAS TRABALHADOS ──
      await sb.from('dias_trabalhados').delete().eq('user_id',uid);

      let diasRows=[];

      if(bk.diasTrabalhados?.length){
        diasRows=bk.diasTrabalhados.map(d=>({
          patrao:d.patrao,
          data:d.data,
          valor:Number(d.valor),
          user_id:uid
        }));
      }else if(bk.workDays){
        // Compatibilidade com backup v2
        Object.entries(bk.workDays).forEach(([key,arr])=>{
          const patrao=key.split('|')[0];

          arr.forEach(d=>diasRows.push({
            patrao,
            data:d.date,
            valor:Number(d.val),
            user_id:uid
          }));
        });
      }else{
        // Backup antigo sem dias trabalhados
        console.warn(
          '[importBackup] Backup não contém dias trabalhados. Versão do backup:',
          bk.version || '?'
        );
      }

      if(diasRows.length) await sb.from('dias_trabalhados').insert(diasRows);

      // ── 4. PAGAMENTOS ──
      await sb.from('pagamentos').delete().eq('user_id',uid);

      let pagRows=[];

      if(bk.pagamentos?.length){
        pagRows=bk.pagamentos.map(p=>({
          patrao:p.patrao,
          valor:Number(p.valor),
          dias_count:Number(p.dias_count || 0),
          data_pagamento:p.data_pagamento,
          ciclo_inicio:p.ciclo_inicio,
          ciclo_fim:p.ciclo_fim,
          observacao:p.observacao || null,
          user_id:uid
        }));
      }

      if(pagRows.length) await sb.from('pagamentos').insert(pagRows);

      // ── 5. CONFIGURAÇÃO ──
      if(bk.cfg) cfg=bk.cfg;

      localStorage.setItem('fin_cfg_'+uid,JSON.stringify(cfg));

      // ── RECARREGA TODOS OS DADOS ──
      await loadAllData();

      // ── MOSTRA O RESUMO DO QUE FOI RESTAURADO ──
      const resumo=[
        gastosRows.length+' gasto(s)',
        patraoRows.length+' patrão(ões)',
        diasRows.length+' dia(s) trabalhado(s)',
        pagRows.length+' pagamento(s)'
      ].join(' · ');

      if(diasRows.length===0 && !bk.diasTrabalhados?.length){
        showToast(
          '⚠️ Backup restaurado, mas sem dias trabalhados. Exporte um backup novo para incluí-los.'
        );
      }else{
        showToast('✅ Backup restaurado! '+resumo);
      }

    }catch(err){
      showToast('Erro ao importar. Verifique o arquivo.',true);
      console.error('[importBackup]',err);
    }
  };

  reader.readAsText(file);
  input.value='';
}

// ── CARREGA TODOS OS DADOS ──
async function loadAllData(){
  const uid=currentUser.id;

  // ── MODO DEV: usa dados do localStorage ──
  if(MODO_DEV){
    console.log('🛠️ [DEV] Carregando dados locais do localStorage');

    const cache=loadOfflineCache();

    gastos=cache.gastos;
    patroes=cache.patroes;
    diasTrabalhados=cache.diasTrabalhados;
    pagamentos=JSON.parse(localStorage.getItem('dev_pagamentos') || '[]');
    activeWorker=null;
    cycleRef=detectCurrentCycle();

    document.getElementById('exp-date').value=
      new Date().toISOString().split('T')[0];

    renderExpenses();
    renderWorkerChips();
    renderWorkerPanel();
    renderCycleConfig();
    return;
  }

  try{
    // ── TENTA BUSCAR OS DADOS NO SUPABASE ──
    const timeout=new Promise((_,rej)=>
      setTimeout(()=>rej(new Error('timeout')),8000)
    );

    const fetchData=Promise.all([
      sb.from('gastos')
        .select('*')
        .eq('user_id',uid)
        .order('data',{ascending:false}),

      sb.from('patroes')
        .select('*')
        .eq('user_id',uid)
        .order('nome'),

      sb.from('dias_trabalhados')
        .select('*')
        .eq('user_id',uid)
        .order('data',{ascending:false}),

      sb.from('pagamentos')
        .select('*')
        .eq('user_id',uid)
        .order('data_pagamento',{ascending:false})
    ]);

    const [rG,rP,rD,rPag]=await Promise.race([fetchData,timeout]);

    gastos=rG.data || [];
    patroes=rP.data || [];
    diasTrabalhados=rD.data || [];
    pagamentos=rPag.data || [];

    // Salva os dados no cache para uso offline
    saveOfflineCache(gastos,patroes,diasTrabalhados);
    setOfflineMode(false);

  }catch(e){
    // ── SEM INTERNET OU TIMEOUT: USA O CACHE LOCAL ──
    console.warn('[Offline] Usando dados do cache local:',e.message);

    const cache=loadOfflineCache();

    gastos=cache.gastos;
    patroes=cache.patroes;
    diasTrabalhados=cache.diasTrabalhados;

    setOfflineMode(true);
  }

  // ── ATUALIZA A INTERFACE ──
  activeWorker=null;
  cycleRef=detectCurrentCycle();

  document.getElementById('exp-date').value=
    new Date().toISOString().split('T')[0];

  renderExpenses();
  renderWorkerChips();
  renderWorkerPanel();
  renderCycleConfig();
}