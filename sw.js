// =============================================
// SERVICE WORKER — Minhas Finanças PWA
// Permite uso offline e instalação como app
// =============================================

const CACHE_NAME = 'financas-v1';

// Arquivos que serão salvos offline
const ASSETS = [
  '/',
  '/index.html',
  '/atualizar-senha.html',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// INSTALA: salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        // Se algum externo falhar, ignora e continua
      });
    })
  );
  self.skipWaiting();
});

// ATIVA: limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// INTERCEPTA requisições
// Estratégia: tenta rede primeiro, se falhar usa cache
self.addEventListener('fetch', event => {
  // Ignora requisições do Supabase (precisam de internet)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Salva uma cópia no cache
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // Sem internet? Usa o cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Se for navegação, mostra o index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
