// =============================================
// SERVICE WORKER v3 — Minhas Finanças PWA
// Estratégia: Cache First para assets estáticos
//             Network First para navegação
// =============================================

const CACHE_STATIC = 'financas-static-v3';
const CACHE_DYNAMIC = 'financas-dynamic-v3';

// Arquivos críticos — app não abre sem eles
// Serão cacheados individualmente para não bloquear em caso de falha
const STATIC_ASSETS = [
  '/index.html',
  '/atualizar-senha.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/sw.js'
];

// Domínios externos importantes (cacheados dinamicamente)
const CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net'
];

// ── INSTALA: cacheia assets críticos um por um ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(async cache => {
      // Cacheia cada arquivo individualmente — se um falhar não bloqueia os outros
      for(const url of STATIC_ASSETS){
        try {
          await cache.add(url);
        } catch(e) {
          console.warn('[SW] Falha ao cachear:', url, e.message);
        }
      }
    })
  );
  // Ativa imediatamente sem esperar abas antigas fecharem
  self.skipWaiting();
});

// ── ATIVA: limpa caches de versões anteriores ──
self.addEventListener('activate', event => {
  const CACHES_VALIDOS = [CACHE_STATIC, CACHE_DYNAMIC];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !CACHES_VALIDOS.includes(k))
          .map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: intercepta todas as requisições ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. Supabase — deixa passar, nunca cacheia dados da API
  if(url.includes('supabase.co')) return;

  // 2. Chrome extensions e outros protocolos — ignora
  if(!url.startsWith('http')) return;

  // 3. CDNs externos (fontes, bibliotecas) — Cache First com fallback
  if(CDN_PATTERNS.some(p => url.includes(p))){
    event.respondWith(cacheFirstStrategy(event.request, CACHE_DYNAMIC));
    return;
  }

  // 4. Navegação (abrindo o app) — Cache First, garante abertura offline
  if(event.request.mode === 'navigate'){
    event.respondWith(
      caches.match('/index.html').then(cached => {
        if(cached){
          // Atualiza em background se tiver internet
          fetch(event.request).then(resp => {
            if(resp && resp.ok){
              caches.open(CACHE_STATIC).then(c => c.put('/index.html', resp));
            }
          }).catch(()=>{});
          return cached;
        }
        // Se não estiver no cache, tenta rede
        return fetch(event.request).catch(() => {
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0f1117;color:#f0f2f8">' +
            '<h2>📵 Sem conexão</h2><p>Conecte-se à internet e tente novamente.</p></body></html>',
            {headers:{'Content-Type':'text/html'}}
          );
        });
      })
    );
    return;
  }

  // 5. Assets estáticos (ícones, arquivos do site) — Cache First
  if(url.includes(self.location.origin)){
    event.respondWith(cacheFirstStrategy(event.request, CACHE_STATIC));
    return;
  }
});

// ── ESTRATÉGIA: Cache First com atualização em background ──
async function cacheFirstStrategy(request, cacheName){
  const cached = await caches.match(request);
  if(cached){
    // Stale-While-Revalidate: retorna cache e atualiza em background
    fetch(request).then(resp => {
      if(resp && resp.ok && resp.type !== 'opaque'){
        caches.open(cacheName).then(c => c.put(request, resp));
      }
    }).catch(()=>{});
    return cached;
  }
  // Não está no cache — busca na rede e cacheia
  try {
    const resp = await fetch(request);
    if(resp && resp.ok){
      const cache = await caches.open(cacheName);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch(e) {
    // Sem internet e sem cache — retorna vazio
    return new Response('', {status: 503, statusText: 'Offline'});
  }
}