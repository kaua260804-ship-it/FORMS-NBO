/* ============================================================
   storage.js — Persistência local (usuário e progresso)
   ============================================================ */

const Storage = (() => {
    const { STORAGE_KEYS } = CONFIG;

    function setUsuario(nome) {
        try { localStorage.setItem(STORAGE_KEYS.USUARIO, nome); } catch (e) {}
    }

    function getUsuario() {
        try { return localStorage.getItem(STORAGE_KEYS.USUARIO) || ''; } catch (e) { return ''; }
    }

    function setEstado(estado) {
        try { localStorage.setItem(STORAGE_KEYS.ESTADO, JSON.stringify(estado)); } catch (e) {}
    }

    function getEstado() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.ESTADO);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function limparEstado() {
        try { localStorage.removeItem(STORAGE_KEYS.ESTADO); } catch (e) {}
    }

    function limparTudo() {
        try {
            localStorage.removeItem(STORAGE_KEYS.ESTADO);
            localStorage.removeItem(STORAGE_KEYS.USUARIO);
        } catch (e) {}
    }

    return { setUsuario, getUsuario, setEstado, getEstado, limparEstado, limparTudo };
})();
