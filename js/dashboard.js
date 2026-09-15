/* ============================================================
   dashboard.js — Leitura de respostas via XLSX local
   - Fonte: dados/RESPOSTAS.xlsx (rápido, sem Apps Script)
   - Filtro de data com datas disponíveis
   - Labels do eixo Y coladas à ESQUERDA com respiro
   - Altura dinâmica conforme número de itens
   ============================================================ */

const Dashboard = (() => {
    const STATUS = { OK: 'SIM', NOK: 'NÃO' };

    const ARQUIVO_RESPOSTAS = 'dados/RESPOSTAS.xlsx';

    const charts = {
        empresa: null, segmento: null, categoria: null,
        grupo: null, simNao: null
    };

    let respostasUnicas = [];
    let respostasBrutas = [];
    const $ = (s) => document.querySelector(s);

    function dbg(msg) { console.log('[Dashboard]', msg); }

    /* ---------------- Normalizador de cabeçalhos ---------------- */
    function normalizar(str) {
        return String(str == null ? '' : str)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    /* ---------------- Parser de data robusto ---------------- */
    function parseDataFlex(valor) {
        if (valor === null || valor === undefined || valor === '') return null;

        if (typeof valor === 'number' && isFinite(valor)) {
            const ms = (valor - 25569) * 86400 * 1000;
            const d = new Date(ms);
            return isNaN(d.getTime()) ? null : d;
        }

        const s = String(valor).trim();
        if (!s) return null;

        let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

        m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    function formatarDataBR(valor) {
        const d = parseDataFlex(valor);
        if (!d) return null;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    function timestampBR(valor) {
        const d = parseDataFlex(valor);
        return d ? d.getTime() : 0;
    }

    /* ---------------- Leitura do XLSX local ---------------- */
    async function lerRespostasXLSX() {
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS (XLSX) não carregado. Verifique a CDN.');
        }

        const resp = await fetch(ARQUIVO_RESPOSTAS + '?v=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) {
            throw new Error(
                `Não encontrei "${ARQUIVO_RESPOSTAS}" (HTTP ${resp.status}). ` +
                `Exporte a aba RESPOSTAS do Google Sheets como .xlsx e salve em dados/.`
            );
        }

        const buffer = await resp.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        if (!workbook.SheetNames || !workbook.SheetNames.length) {
            throw new Error('XLSX sem abas.');
        }

        // Pega a primeira aba (mesmo que se chame "RESPOSTAS" ou outra)
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const linhas = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            defval: ''
        });

        if (!linhas.length) return [];

        const cabecalhos = linhas[0].map((h) => String(h || '').trim());
        const registros = [];

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i];
            if (!linha || !linha.length) continue;

            const obj = {};
            let vazio = true;
            for (let j = 0; j < cabecalhos.length; j++) {
                const chave = cabecalhos[j];
                if (!chave) continue;
                const valor = linha[j] == null ? '' : String(linha[j]).trim();
                obj[chave] = valor;
                if (valor !== '') vazio = false;
            }
            if (!vazio) registros.push(obj);
        }
        return registros;
    }

    /* ---------------- Deduplicação ----------------
       Chave: DATA | EMPRESA | CODIGO | USUARIO
       SIM vence qualquer NÃO no mesmo dia/usuário/código.
    ------------------------------------------------- */
    function deduplicar(lista) {
        const mapa = new Map();
        lista.forEach((r) => {
            const dataBR = formatarDataBR(r.DATA) || String(r.DATA || '').trim();
            const chave = [
                dataBR,
                String(r.EMPRESA || '').trim().toUpperCase(),
                String(r.CODIGO || '').trim(),
                String(r.USUARIO || '').trim().toUpperCase()
            ].join('|');

            const status = String(r.STATUS || '').trim().toUpperCase();
            const isSim = status === 'SIM';
            const isNao = status === 'NÃO' || status === 'NAO';
            if (!isSim && !isNao) return;

            if (!mapa.has(chave)) mapa.set(chave, { registro: { ...r, DATA: dataBR }, temSim: isSim });
            else if (isSim) mapa.get(chave).temSim = true;
        });

        const resultado = [];
        mapa.forEach((v) => {
            const r = { ...v.registro };
            r.STATUS = v.temSim ? STATUS.OK : STATUS.NOK;
            resultado.push(r);
        });
        return resultado;
    }

    /* ---------------- Filtros ---------------- */
    function aplicarFiltros(lista) {
        const dataDe    = $('#filtroDataDe').value;
        const dataAte   = $('#filtroDataAte').value;
        const empresa   = $('#filtroEmpresa').value.trim().toUpperCase();
        const tipo      = $('#filtroTipo').value.trim().toUpperCase();
        const grupo     = $('#filtroGrupo').value.trim().toUpperCase();
        const subgrupo  = $('#filtroSubgrupo').value.trim().toUpperCase();

        const tsDe  = dataDe  ? timestampBR(dataDe)  : null;
        const tsAte = dataAte ? timestampBR(dataAte) : null;

        return lista.filter((r) => {
            if (empresa  && String(r.EMPRESA  || '').toUpperCase() !== empresa)  return false;
            if (tipo     && String(r.TIPO     || '').toUpperCase() !== tipo)     return false;
            if (grupo    && String(r.GRUPO    || '').toUpperCase() !== grupo)    return false;
            if (subgrupo && String(r.SUBGRUPO || '').toUpperCase() !== subgrupo) return false;

            if (tsDe != null || tsAte != null) {
                const ts = timestampBR(r.DATA);
                if (!ts) return false;
                if (tsDe  != null && ts < tsDe)  return false;
                if (tsAte != null && ts > tsAte) return false;
            }
            return true;
        });
    }

    /* ---------------- Agregações ---------------- */
    function agruparPor(lista, campo) {
        const map = new Map();
        lista.forEach((r) => {
            const k = String(r[campo] || '—').trim() || '—';
            if (!map.has(k)) map.set(k, { total: 0, nao: 0, sim: 0 });
            const g = map.get(k);
            g.total++;
            if (String(r.STATUS).toUpperCase() === STATUS.NOK) g.nao++;
            else g.sim++;
        });
        return Array.from(map.entries()).map(([k, v]) => ({
            chave: k, total: v.total, nao: v.nao, sim: v.sim,
            perc: v.total ? (v.nao / v.total) * 100 : 0
        })).sort((a, b) => b.perc - a.perc);
    }

    function topProdutosRuptura(lista, limite = 10) {
        const map = new Map();
        lista.forEach((r) => {
            if (String(r.STATUS).toUpperCase() !== STATUS.NOK) return;
            const k = String(r.PRODUTO || '—').trim() || '—';
            map.set(k, (map.get(k) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([produto, qtd]) => ({ produto, qtd }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, limite);
    }

    /* ---------------- Selects ---------------- */
    function valoresUnicos(lista, campo) {
        const set = new Set();
        lista.forEach((r) => {
            const v = String(r[campo] || '').trim();
            if (v) set.add(v);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    function datasUnicas(lista) {
        const set = new Set();
        lista.forEach((r) => {
            const d = formatarDataBR(r.DATA);
            if (d) set.add(d);
        });
        return Array.from(set).sort((a, b) => timestampBR(a) - timestampBR(b));
    }

    function preencherSelect(sel, valores, textoVazio = 'Todos') {
        const el = $(sel);
        if (!el) return;
        const atual = el.value;
        el.innerHTML = `<option value="">${textoVazio}</option>`;
        valores.forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            el.appendChild(opt);
        });
        if (valores.includes(atual)) el.value = atual;
    }

    function atualizarSelects() {
        preencherSelect('#filtroEmpresa',  valoresUnicos(respostasUnicas, 'EMPRESA'),  'Todas');
        preencherSelect('#filtroTipo',     valoresUnicos(respostasUnicas, 'TIPO'),     'Todos');
        preencherSelect('#filtroGrupo',    valoresUnicos(respostasUnicas, 'GRUPO'),    'Todos');
        preencherSelect('#filtroSubgrupo', valoresUnicos(respostasUnicas, 'SUBGRUPO'), 'Todos');

        const datas = datasUnicas(respostasUnicas);
        dbg(`Datas disponíveis (${datas.length}): ${datas.join(', ') || 'nenhuma'}`);
        preencherSelect('#filtroDataDe',  datas, 'Todas');
        preencherSelect('#filtroDataAte', datas, 'Todas');
    }

    /* ---------------- Render ---------------- */
    function render() {
        const lista = aplicarFiltros(respostasUnicas);

        const total = lista.length;
        const nao = lista.filter((r) => String(r.STATUS).toUpperCase() === STATUS.NOK).length;
        const sim = total - nao;
        const percRuptura = total ? (nao / total) * 100 : 0;

        $('#kpiRuptura').textContent = total ? percRuptura.toFixed(1).replace('.', ',') + '%' : '—';
        $('#kpiRupturaSub').textContent = `${total} item(ns) avaliado(s)`;
        $('#kpiTotal').textContent = total;
        $('#kpiNao').textContent = nao;
        $('#kpiNaoSub').textContent = total ? ((nao/total)*100).toFixed(1).replace('.', ',') + '%' : '0%';
        $('#kpiSim').textContent = sim;
        $('#kpiSimSub').textContent = total ? ((sim/total)*100).toFixed(1).replace('.', ',') + '%' : '0%';

        const porEmpresa   = agruparPor(lista, 'EMPRESA');
        const porCategoria = agruparPor(lista, 'CATEGORIA');
        const porGrupo     = agruparPor(lista, 'GRUPO');
        const topProdutos  = topProdutosRuptura(lista, 10);

        const segmentoMap = new Map();
        lista.forEach((r) => {
            const tipo = String(r.TIPO || '').toUpperCase();
            let seg = 'Outros';
            if (tipo.includes('MERCEARIA')) seg = 'Mercearia';
            else if (tipo.includes('EMPORIO') || tipo.includes('EMPÓRIO')) seg = 'Empório';
            if (!segmentoMap.has(seg)) segmentoMap.set(seg, { total: 0, nao: 0 });
            segmentoMap.get(seg).total++;
            if (String(r.STATUS).toUpperCase() === STATUS.NOK) segmentoMap.get(seg).nao++;
        });

        desenharBarra('#chartEmpresa',   porEmpresa,   true);
        desenharBarra('#chartCategoria', porCategoria, false);
        desenharBarra('#chartGrupo',     porGrupo,     true);
        desenharPizzaSegmento('#chartSegmento', segmentoMap);
        desenharPizzaSimNao('#chartSimNao', sim, nao);

        const tbody = $('#tabelaTopProdutos');
        tbody.innerHTML = '';
        if (!topProdutos.length) {
            tbody.innerHTML = '<tr><td colspan="2" class="tac muted">Sem dados.</td></tr>';
        } else {
            topProdutos.forEach((p) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${p.produto}</td><td class="tac"><strong>${p.qtd}</strong></td>`;
                tbody.appendChild(tr);
            });
        }
    }

    /* ---------------- Cores ---------------- */
    const COR_AZUL = '#2563eb';
    const COR_AZUL_ESCURO = '#1e40af';
    const COR_LARANJA = '#f97316';
    const COR_VERDE = '#22c55e';
    const COR_VERMELHO = '#ef4444';
    const COR_CINZA = '#94a3b8';

    /* ---------------- Plugin datalabels ---------------- */
    function garantirDatalabels() {
        if (typeof Chart === 'undefined') return false;
        if (typeof ChartDataLabels === 'undefined') return false;
        try { Chart.register(ChartDataLabels); } catch (e) {}
        return true;
    }

    /* ---------------- Altura dinâmica ---------------- */
    function calcularAltura(qtdBarras) {
        const base = 90;
        const porBarra = 38;
        const altura = base + qtdBarras * porBarra;
        return Math.max(320, Math.min(1400, altura));
    }

    /* ---------------- Gráficos ---------------- */
    function desenharBarra(sel, dados, horizontal) {
        const ctx = document.querySelector(sel);
        if (!ctx || typeof Chart === 'undefined') return;

        const temPlugin = garantirDatalabels();

        const labels = dados.map((d) => d.chave);
        const valores = dados.map((d) => Number(d.perc.toFixed(2)));

        const wrapper = ctx.parentElement;
        if (wrapper && horizontal) {
            wrapper.style.height = calcularAltura(labels.length) + 'px';
        } else if (wrapper) {
            wrapper.style.height = '';
        }

        const cfg = {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '% Ruptura',
                    data: valores,
                    backgroundColor: COR_AZUL,
                    hoverBackgroundColor: COR_AZUL_ESCURO,
                    borderRadius: 4,
                    maxBarThickness: horizontal ? 18 : 60
                }]
            },
            plugins: temPlugin ? [ChartDataLabels] : [],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: horizontal ? 6 : 30,
                        right: horizontal ? 70 : 12,
                        left: 8,
                        bottom: 6
                    }
                },
                indexAxis: horizontal ? 'y' : 'x',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` ${Number(c.raw).toFixed(1).replace('.', ',')}% ruptura`
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#0f172a',
                        anchor: horizontal ? 'end' : 'end',
                        align: horizontal ? 'right' : 'top',
                        offset: horizontal ? 8 : 6,
                        clamp: true,
                        clip: false,
                        formatter: (v) => Number(v).toFixed(1).replace('.', ',') + '%',
                        font: { weight: '800', size: 12 }
                    }
                },
                scales: {
                    x: horizontal
                        ? {
                            beginAtZero: true, max: 100,
                            ticks: { callback: (v) => v + '%', color: '#475569' },
                            grid: { color: '#e2e8f0' }
                        }
                        : {
                            ticks: {
                                color: '#0f172a',
                                font: { weight: '600' },
                                autoSkip: false,
                                maxRotation: 45
                            },
                            grid: { display: false }
                        },
                    y: horizontal
                        ? {
                            ticks: {
                                color: '#0f172a',
                                font: { weight: '700', size: 11 },
                                autoSkip: false,
                                crossAlign: 'far',
                                padding: 24
                            },
                            grid: { display: false }
                        }
                        : {
                            beginAtZero: true, max: 100,
                            ticks: { callback: (v) => v + '%', color: '#475569' },
                            grid: { color: '#e2e8f0' }
                        }
                }
            }
        };

        const key = sel.replace('#chart', '').toLowerCase();
        if (charts[key]) charts[key].destroy();
        charts[key] = new Chart(ctx, cfg);
    }

    function desenharPizzaSegmento(sel, mapa) {
        const ctx = document.querySelector(sel);
        if (!ctx || typeof Chart === 'undefined') return;

        const temPlugin = garantirDatalabels();

        const labels = Array.from(mapa.keys());
        const valores = labels.map((k) => mapa.get(k).nao);
        const cores = labels.map((k) => k === 'Mercearia' ? COR_AZUL : k === 'Empório' ? COR_LARANJA : COR_CINZA);

        if (charts.segmento) charts.segmento.destroy();
        charts.segmento = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: valores, backgroundColor: cores, borderWidth: 2, borderColor: '#fff' }]
            },
            plugins: temPlugin ? [ChartDataLabels] : [],
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                layout: { padding: 8 },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#0f172a', font: { weight: '600' } } },
                    tooltip: {
                        callbacks: {
                            label: (c) => {
                                const total = c.dataset.data.reduce((a,b) => a+b, 0);
                                const v = c.raw;
                                const p = total ? ((v/total)*100).toFixed(1).replace('.', ',') : '0';
                                return ` ${c.label}: ${v} (${p}%)`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#ffffff',
                        font: { weight: '800', size: 13 },
                        formatter: (v, c) => {
                            const total = c.dataset.data.reduce((a,b) => a+b, 0);
                            if (!total || !v) return '';
                            return ((v / total) * 100).toFixed(1).replace('.', ',') + '%';
                        }
                    }
                }
            }
        });
    }

    function desenharPizzaSimNao(sel, sim, nao) {
        const ctx = document.querySelector(sel);
        if (!ctx || typeof Chart === 'undefined') return;

        const temPlugin = garantirDatalabels();

        if (charts.simNao) charts.simNao.destroy();
        charts.simNao = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['SIM (com estoque)', 'NÃO (ruptura)'],
                datasets: [{ data: [sim, nao], backgroundColor: [COR_VERDE, COR_VERMELHO], borderWidth: 2, borderColor: '#fff' }]
            },
            plugins: temPlugin ? [ChartDataLabels] : [],
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                layout: { padding: 8 },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#0f172a', font: { weight: '600' } } },
                    tooltip: {
                        callbacks: {
                            label: (c) => {
                                const total = c.dataset.data.reduce((a,b) => a+b, 0);
                                const v = c.raw;
                                const p = total ? ((v/total)*100).toFixed(1).replace('.', ',') : '0';
                                return ` ${c.label}: ${v} (${p}%)`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#ffffff',
                        font: { weight: '800', size: 13 },
                        formatter: (v, c) => {
                            const total = c.dataset.data.reduce((a,b) => a+b, 0);
                            if (!total || !v) return '';
                            return ((v / total) * 100).toFixed(1).replace('.', ',') + '%';
                        }
                    }
                }
            }
        });
    }

    /* ---------------- Carregamento (local) ---------------- */
    async function carregar() {
        UI.loading('Carregando respostas...');
        try {
            const brutos = await lerRespostasXLSX();
            respostasBrutas = brutos;
            dbg(`Respostas brutas: ${brutos.length}`);
            if (brutos.length) {
                dbg(`Exemplo de DATA: ${JSON.stringify(brutos[0].DATA)} (tipo: ${typeof brutos[0].DATA})`);
            }

            respostasUnicas = deduplicar(brutos);
            dbg(`Respostas únicas: ${respostasUnicas.length}`);

            atualizarSelects();
            render();
            UI.toast(`✔ ${respostasUnicas.length} registro(s) único(s) carregado(s).`, 'success', 2500);
        } catch (e) {
            UI.toast('Erro ao carregar respostas: ' + e.message, 'error', 8000);
            console.error('[Dashboard] Erro:', e);
            // Mensagem amigável no resumo se XLSX não existir
            const box = $('#resumoBox');
            if (box) {
                box.innerHTML = `
                    <div class="resumo__card" style="border-left:4px solid var(--danger)">
                        <strong>Arquivo <code>${ARQUIVO_RESPOSTAS}</code> não encontrado</strong>
                        <p class="muted" style="margin-top:8px">
                            1. Abra a planilha Google → aba <strong>RESPOSTAS</strong><br>
                            2. <strong>Arquivo → Fazer download → Microsoft Excel (.xlsx)</strong><br>
                            3. Renomeie para <code>RESPOSTAS.xlsx</code> e coloque em <code>dados/</code><br>
                            4. Recarregue a página (Ctrl+F5)
                        </p>
                    </div>
                `;
            }
        } finally {
            UI.hideLoading();
        }
    }

    /* ---------------- Bind ---------------- */
    function bind() {
        ['#filtroDataDe', '#filtroDataAte', '#filtroEmpresa', '#filtroTipo', '#filtroGrupo', '#filtroSubgrupo']
            .forEach((sel) => {
                const el = $(sel);
                if (el) el.addEventListener('change', render);
            });

        $('#filtroLimpar').addEventListener('click', () => {
            ['#filtroDataDe', '#filtroDataAte', '#filtroEmpresa', '#filtroTipo', '#filtroGrupo', '#filtroSubgrupo']
                .forEach((sel) => { const el = $(sel); if (el) el.value = ''; });
            render();
        });

        $('#dashAtualizar').addEventListener('click', carregar);

        $('#dashSair').addEventListener('click', () => {
            if (!confirm('Sair do dashboard?')) return;
            location.reload();
        });
    }

    let iniciado = false;
    async function iniciar() {
        if (iniciado) { await carregar(); return; }
        iniciado = true;
        garantirDatalabels();
        bind();
        await carregar();
    }

    return { iniciar };
})();

window.Dashboard = Dashboard;