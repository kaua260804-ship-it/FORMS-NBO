/* ============================================================
   api.js — Comunicação com Google Apps Script
   - GET/POST com timeout maior
   - Retry apenas em erros "recuperáveis" (NÃO em abort)
   - Cache simples em memória (evita refetch desnecessário)
   ============================================================ */

const API = (() => {
    const TIMEOUT = 120000;      // 2 min (GAS pode demorar em payloads grandes)
    const MAX_TENTATIVAS = 2;    // era 3; reduzido para não acumular lentidão
    const CACHE_TTL_MS = 60 * 1000;

    const _cache = new Map();    // chave -> { ts, dados }

    function getUrlBase() {
        return (window.CONFIG && window.CONFIG.APPS_SCRIPT_URL) || '';
    }

    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

    function getCache(chave) {
        const item = _cache.get(chave);
        if (!item) return null;
        if (Date.now() - item.ts > CACHE_TTL_MS) {
            _cache.delete(chave);
            return null;
        }
        return item.dados;
    }
    function setCache(chave, dados) {
        _cache.set(chave, { ts: Date.now(), dados });
    }
    function limparCache() { _cache.clear(); }

    /* ---------------- GET com retry controlado ---------------- */
    async function getComRetry(params = {}, opcoes = {}) {
        const base = getUrlBase();
        if (!base) throw new Error('APPS_SCRIPT_URL não configurada em js/config.js');

        const chaveCache = 'GET::' + JSON.stringify(params);
        if (!opcoes.semCache) {
            const cacheado = getCache(chaveCache);
            if (cacheado) {
                console.log('[API] (cache) ' + chaveCache);
                return cacheado;
            }
        }

        const url = new URL(base);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) url.searchParams.set(k, v);
        });

        let ultimoErro = null;

        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort('timeout'), TIMEOUT);
            let abortado = false;

            try {
                const resp = await fetch(url.toString(), {
                    method: 'GET',
                    signal: controller.signal,
                    redirect: 'follow',
                    cache: 'no-store'
                });

                clearTimeout(timer);

                if (resp.ok) {
                    const json = await resp.json();
                    setCache(chaveCache, json);
                    return json;
                }

                ultimoErro = new Error(`HTTP ${resp.status}`);

                // 404 do redirect interno do Google: retry, mas espera mais
                if (resp.status === 404 && tentativa < MAX_TENTATIVAS) {
                    console.warn(`[API] 404 do GAS (tentativa ${tentativa}/${MAX_TENTATIVAS}), aguardando...`);
                    await esperar(2000 * tentativa);
                    continue;
                }

                // 4xx (menos 404) → não adianta retry
                if (resp.status !== 404 && resp.status < 500) {
                    break;
                }

            } catch (e) {
                clearTimeout(timer);
                ultimoErro = e;

                // AbortError = timeout NOSSO → NÃO fazer retry (evita acumular)
                if (e && (e.name === 'AbortError' || String(e.message || e).includes('abort'))) {
                    console.warn('[API] Timeout, não vou tentar de novo.');
                    abortado = true;
                    break;
                }

                // Falha de rede simples → tenta de novo
                if (tentativa < MAX_TENTATIVAS) {
                    await esperar(1500 * tentativa);
                    continue;
                }
            } finally {
                if (!abortado) clearTimeout(timer);
            }
        }

        throw ultimoErro || new Error('Falha ao consultar o Apps Script.');
    }

    /* ---------------- POST com retry controlado ---------------- */
    async function postComRetry(payload) {
        const base = getUrlBase();
        if (!base) throw new Error('APPS_SCRIPT_URL não configurada em js/config.js');

        let ultimoErro = null;

        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort('timeout'), TIMEOUT);
            let abortado = false;

            try {
                const resp = await fetch(base, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    signal: controller.signal,
                    redirect: 'follow'
                });

                clearTimeout(timer);

                if (resp.ok) {
                    const json = await resp.json();
                    // Se gravou, invalida o cache de respostas
                    limparCache();
                    return json;
                }

                ultimoErro = new Error(`HTTP ${resp.status}`);

                if (resp.status === 404 && tentativa < MAX_TENTATIVAS) {
                    await esperar(2000 * tentativa);
                    continue;
                }

                if (resp.status !== 404 && resp.status < 500) break;

            } catch (e) {
                clearTimeout(timer);
                ultimoErro = e;

                if (e && (e.name === 'AbortError' || String(e.message || e).includes('abort'))) {
                    abortado = true;
                    break;
                }

                if (tentativa < MAX_TENTATIVAS) {
                    await esperar(1500 * tentativa);
                    continue;
                }
            } finally {
                if (!abortado) clearTimeout(timer);
            }
        }

        throw ultimoErro || new Error('Falha ao enviar ao Apps Script.');
    }

    /* ---------------- API pública ---------------- */
    const salvarRespostas = (respostas) => postComRetry({ action: 'salvar', respostas });
    const getRespostas    = (opcoes = {}) => getComRetry({ action: 'respostas' }, opcoes);
    const ping            = ()            => getComRetry({ action: 'ping' });

    return { salvarRespostas, getRespostas, ping, limparCache };
})();

window.API = API;