/* ============================================================
   api.js — Comunicação com Google Apps Script
   ============================================================ */

const API = (() => {
    const TIMEOUT = 45000;

    function getUrlBase() {
        return (window.CONFIG && window.CONFIG.APPS_SCRIPT_URL) || '';
    }

    async function get(params = {}) {
        const base = getUrlBase();
        if (!base) throw new Error('APPS_SCRIPT_URL não configurada.');

        const url = new URL(base);
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

    async function post(payload) {
        const base = getUrlBase();
        if (!base) throw new Error('APPS_SCRIPT_URL não configurada.');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);

        try {
            const resp = await fetch(base, {
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

    const salvarRespostas = (respostas) => post({ action: 'salvar', respostas });
    const getRespostas    = ()            => get({ action: 'respostas' });
    const ping            = ()            => get({ action: 'ping' });

    return { salvarRespostas, getRespostas, ping };
})();

window.API = API;