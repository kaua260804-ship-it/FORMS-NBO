/* ============================================================
   main.js — Inicialização e helpers de UI
   ============================================================ */

const UI = (() => {
    function toast(msg, tipo = 'info', duracao = 3500) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast toast--${tipo}`;
        const icones = { success: 'fa-check-circle', error: 'fa-circle-xmark', info: 'fa-info-circle' };
        el.innerHTML = `<i class="fas ${icones[tipo] || icones.info}"></i><span class="toast__msg">${msg}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            el.style.transition = 'all .3s';
            setTimeout(() => el.remove(), 320);
        }, duracao);
    }

    function loading(msg = 'Carregando...') {
        const l = document.getElementById('loading');
        const m = document.getElementById('loadingMsg');
        if (m) m.textContent = msg;
        if (l) l.hidden = false;
    }

    function hideLoading() {
        const l = document.getElementById('loading');
        if (l) l.hidden = true;
    }

    return { toast, loading, hideLoading };
})();

window.UI = UI;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof Wizard === 'undefined') {
        UI.toast('Módulo Wizard não carregado. Verifique o Console (F12).', 'error', 8000);
        return;
    }
    Wizard.iniciar();
});