/* ============================================================
   config.js — Constantes e configuração global
   ============================================================ */

const CONFIG = {
    /** URL do Web App do Google Apps Script */
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyulpzUhq-kw69nqTvcjSMhncb6kYFiWKUYVyV9YX1G8FqVZTbo68Jjw7rLQMRHOqJ1/exec',

    /** Timeout das requisições (ms) */
    TIMEOUT: 45000,

    /** Chaves do localStorage */
    STORAGE_KEYS: {
        USUARIO: 'conf_estoque_usuario',
        ESTADO:  'conf_estoque_estado'
    },

    /** Status possíveis */
    STATUS: {
        OK:  'SIM',
        NOK: 'NÃO'
    },

    /** Usuário com acesso ao dashboard */
    USUARIO_DASHBOARD: 'FR1B4L',

    /** Etapas do wizard */
    STEPS: {
        USUARIO:    0,
        EMPRESA:    1,
        CATEGORIA:  2,
        GRUPO:      3,
        PRODUTOS:   4,
        RESUMO:     5,
        DASHBOARD:  6
    },

    TOTAL_STEPS: 5
};

// Garante exposição global (alguns bundlers/navegadores podem isolar)
window.CONFIG = CONFIG;