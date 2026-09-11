/* ============================================================
   config.js — Constantes e configuração global
   ============================================================ */

const CONFIG = {
    /**
     * URL do Web App do Google Apps Script.
     * Substitua pela URL gerada no deploy.
     */
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyulpzUhq-kw69nqTvcjSMhncb6kYFiWKUYVyV9YX1G8FqVZTbo68Jjw7rLQMRHOqJ1/exec',

    /** Timeout das requisições (ms) */
    TIMEOUT: 45000,

    /** Chaves do localStorage */
    STORAGE_KEYS: {
        USUARIO: 'conf_estoque_usuario',
        ESTADO:  'conf_estoque_estado'
    },

    /** Status possíveis (gravados na coluna STATUS) */
    STATUS: {
        OK:  'SIM',
        NOK: 'NÃO'
    },

    /** Etapas do wizard */
    STEPS: {
        USUARIO:    0,
        EMPRESA:    1,
        CATEGORIA:  2,
        GRUPO:      3,
        PRODUTOS:   4,
        RESUMO:     5
    },

    /** Total de etapas (usado na barra de progresso) */
    TOTAL_STEPS: 5
};
