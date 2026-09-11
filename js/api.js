/* ============================================================
   api.js — Comunicação com Google Apps Script (Web App)
   ============================================================ */

const API = (() => {
    const { APPS_SCRIPT_URL, TIMEOUT } = CONFIG;

    /** Requisição com timeout (GET) */
    async function get(params = {}) {
        const url = new URL(APPS_SCRIPT_URL);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);

        try {
            const resp = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } finally {
            clearTimeout(timer);
        }
    }

    /** POST em text/plain para evitar preflight CORS */
    async function post(payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);

        try {
            const resp = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                signal: controller.signal,
                redirect: 'follow'
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } finally {
            clearTimeout(timer);
        }
    }

    const getEmpresas     = ()                    => get({ action: 'empresas' });
    const getCategorias   = (empresa)             => get({ action: 'categorias', empresa });
    const getProdutos     = (empresa, categoria)  => get({ action: 'produtos', empresa, categoria });
    const salvarRespostas = (respostas)           => post({ action: 'salvar', respostas });

    return { getEmpresas, getCategorias, getProdutos, salvarRespostas };
})();
