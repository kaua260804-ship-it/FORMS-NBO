/* ============================================================
   main.js — Inicialização e helpers de UI (toast/loading)
   ============================================================ */

const UI = (() => {
    let toastId = 0;

    /** Exibe notificação temporária */
    function toast(msg, tipo = 'info', duracao = 3500) {
        const container = document.getElementById('toastContainer');
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

    /** Mostra o loading global */
    function loading(msg = 'Carregando...') {
        document.getElementById('loadingMsg').textContent = msg;
        document.getElementById('loading').hidden = false;
    }

    /** Esconde o loading */
    function hideLoading() {
        document.getElementById('loading').hidden = true;
    }

    return { toast, loading, hideLoading };
})();

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', () => {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.includes('COLE_AQUI')) {
        UI.toast('Configure a URL do Apps Script em js/config.js antes de usar.', 'error', 8000);
    }
    Wizard.iniciar();
});
