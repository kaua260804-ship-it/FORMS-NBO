/* ============================================================
   storage.js — Persistência local (usuário e progresso)
   ============================================================ */

const Storage = (() => {
    const KEYS = {
        USUARIO: 'conf_estoque_usuario',
        ESTADO:  'conf_estoque_estado'
    };

    function setUsuario(nome) {
        try { localStorage.setItem(KEYS.USUARIO, nome); } catch (e) {}
    }

    function getUsuario() {
        try { return localStorage.getItem(KEYS.USUARIO) || ''; } catch (e) { return ''; }
    }

    function setEstado(estado) {
        try { localStorage.setItem(KEYS.ESTADO, JSON.stringify(estado)); } catch (e) {}
    }

    function getEstado() {
        try {
            const raw = localStorage.getItem(KEYS.ESTADO);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function limparEstado() {
        try { localStorage.removeItem(KEYS.ESTADO); } catch (e) {}
    }

    function limparTudo() {
        try {
            localStorage.removeItem(KEYS.ESTADO);
            localStorage.removeItem(KEYS.USUARIO);
        } catch (e) {}
    }

    return { setUsuario, getUsuario, setEstado, getEstado, limparEstado, limparTudo };
})();

window.Storage = Storage;