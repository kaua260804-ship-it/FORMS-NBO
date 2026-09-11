/* ============================================================
   wizard.js — Controle de etapas, renderização e regras
   ============================================================ */

const Wizard = (() => {
    const { STEPS, MOTIVOS, STATUS, TOTAL_STEPS } = CONFIG;

    /* ---------- Estado ---------- */
    const state = {
        usuario: '',
        empresa: '',
        categoria: '',
        grupo: '',           // grupo escolhido ('' = todos)
        produtos: [],        // produtos (empresa + categoria)
        grupos: [],          // [{ nome, nomeKey, produtos, total }]
        respostas: {},       // { codigo: { status, motivo } }
        enviado: false
    };

    const $  = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    /* ---------- Helpers ---------- */
    const pad = (n) => String(n).padStart(2, '0');

    function agora() {
        const d = new Date();
        return {
            data: `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`,
            hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        };
    }

    /** Normaliza string: remove acentos, espaços extras, minúsculas. */
    function normalizar(str) {
        return String(str == null ? '' : str)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();
    }

    function codigoDe(p) {
        return String(p['Codigo C5'] || p.CODIGO || '').trim();
    }

    /* ---------- Navegação ---------- */
    function irPara(step, opcoes = {}) {
        if (step < 0 || step > 5) return;
        if (opcoes.salvarEstado !== false) persistir();

        $$('.step').forEach((el) => { el.hidden = Number(el.dataset.step) !== step; });

        const pct = (step / TOTAL_STEPS) * 100;
        $('#progressBar').style.width = `${pct}%`;

        $$('.step-dot').forEach((dot) => {
            const n = Number(dot.dataset.step);
            dot.classList.toggle('active', n === step);
            dot.classList.toggle('done', n < step);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ---------- Persistência ---------- */
    function persistir() {
        Storage.setEstado({
            usuario:   state.usuario,
            empresa:   state.empresa,
            categoria: state.categoria,
            grupo:     state.grupo,
            respostas: state.respostas,
            enviado:   state.enviado
        });
    }

    function restaurar() {
        const saved = Storage.getEstado();
        if (!saved) return null;
        Object.assign(state, saved);
        return saved;
    }

    /* ============================================================
       TELA 0 — Usuário
       ============================================================ */
    function initUsuario() {
        const input = $('#inputUsuario');
        const erro  = $('#erroUsuario');
        const btn   = $('#btnIniciar');

        if (state.usuario) input.value = state.usuario;

        btn.addEventListener('click', () => {
            const nome = input.value.trim();
            if (nome.length < 2) {
                erro.textContent = 'Informe um nome válido (mínimo 2 caracteres).';
                input.classList.add('is-invalid');
                input.focus();
                return;
            }
            erro.textContent = '';
            input.classList.remove('is-invalid');
            state.usuario = nome;
            Storage.setUsuario(nome);
            atualizarLabelUsuario();
            persistir();
            carregarEmpresas();
            irPara(STEPS.EMPRESA);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btn.click();
        });
    }

    function atualizarLabelUsuario() {
        const wrap  = $('#btnUsuario');
        const label = $('#usuarioLabel');
        if (state.usuario) {
            label.textContent = state.usuario;
            wrap.hidden = false;
        } else {
            wrap.hidden = true;
        }
    }

    /* ============================================================
       TELA 1 — Empresa
       ============================================================ */
    async function carregarEmpresas() {
        if ($('#listaEmpresas').children.length > 0) return;

        UI.loading('Carregando empresas...');
        try {
            const resp = await API.getEmpresas();
            if (!resp.sucesso) throw new Error(resp.mensagem || 'Falha ao carregar empresas.');
            renderEmpresas(resp.dados || []);
        } catch (e) {
            UI.toast('Erro ao carregar empresas: ' + e.message, 'error');
            $('#listaEmpresas').innerHTML =
                '<p class="muted">Não foi possível carregar. <button class="btn btn--primary" onclick="location.reload()">Tentar novamente</button></p>';
        } finally {
            UI.hideLoading();
        }
    }

    function renderEmpresas(empresas) {
        const box = $('#listaEmpresas');
        box.innerHTML = '';

        if (!empresas.length) {
            box.innerHTML = '<p class="muted">Nenhuma empresa encontrada.</p>';
            return;
        }

        empresas.forEach((emp) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card';
            btn.textContent = emp;
            if (emp === state.empresa) btn.classList.add('selected');
            btn.addEventListener('click', () => {
                state.empresa = emp;
                state.categoria = '';
                state.grupo = '';
                state.produtos = [];
                state.grupos = [];
                state.respostas = {};
                persistir();
                carregarCategorias(emp);
                irPara(STEPS.CATEGORIA);
            });
            box.appendChild(btn);
        });

        const busca = $('#buscaEmpresa');
        busca.value = '';
        busca.oninput = () => {
            const t = normalizar(busca.value);
            Array.from(box.children).forEach((el) => {
                el.hidden = !normalizar(el.textContent).includes(t);
            });
        };
    }

    /* ============================================================
       TELA 2 — Categoria
       ============================================================ */
    async function carregarCategorias(empresa) {
        $('#empresaSelecionadaLabel').textContent = `Empresa: ${empresa}`;
        $('#listaCategorias').innerHTML = '';
        UI.loading('Carregando categorias...');

        try {
            const resp = await API.getCategorias(empresa);
            if (!resp.sucesso) throw new Error(resp.mensagem || 'Falha ao carregar categorias.');
            renderCategorias(resp.dados || []);
        } catch (e) {
            UI.toast('Erro ao carregar categorias: ' + e.message, 'error');
        } finally {
            UI.hideLoading();
        }
    }

    function renderCategorias(categorias) {
        const box = $('#listaCategorias');
        box.innerHTML = '';

        if (!categorias.length) {
            box.innerHTML = '<p class="muted">Nenhuma categoria encontrada.</p>';
            return;
        }

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'card card--all';
        allBtn.innerHTML = '<i class="fas fa-layer-group"></i> Todas as categorias';
        allBtn.addEventListener('click', () => selecionarCategoria(''));
        box.appendChild(allBtn);

        categorias.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card';
            btn.textContent = cat;
            if (cat === state.categoria) btn.classList.add('selected');
            btn.addEventListener('click', () => selecionarCategoria(cat));
            box.appendChild(btn);
        });

        const busca = $('#buscaCategoria');
        busca.value = '';
        busca.oninput = () => {
            const t = normalizar(busca.value);
            Array.from(box.children).forEach((el) => {
                el.hidden = !normalizar(el.textContent).includes(t);
            });
        };
    }

    async function selecionarCategoria(categoria) {
        state.categoria = categoria;
        state.grupo = '';
        state.produtos = [];
        state.grupos = [];
        state.respostas = {};
        persistir();

        await carregarProdutos();
        renderGrupos();
        irPara(STEPS.GRUPO);
    }

    /* ============================================================
       Carregamento de produtos + agrupamento
       ============================================================ */
    async function carregarProdutos() {
        UI.loading('Carregando produtos...');
        try {
            const resp = await API.getProdutos(state.empresa, state.categoria);
            if (!resp.sucesso) throw new Error(resp.mensagem || 'Falha ao carregar produtos.');

            state.produtos = resp.dados || [];
            agruparProdutos();
            reconciliarGrupoSelecionado();
        } catch (e) {
            UI.toast('Erro ao carregar produtos: ' + e.message, 'error');
            state.produtos = [];
            state.grupos = [];
        } finally {
            UI.hideLoading();
        }
    }

    function agruparProdutos() {
        const mapa = new Map();

        state.produtos.forEach((p) => {
            const nomeBruto = String(p.GRUPO == null ? '' : p.GRUPO).trim();
            const nome = nomeBruto || 'SEM GRUPO';
            const key = normalizar(nome);

            if (!mapa.has(key)) {
                mapa.set(key, { nome, nomeKey: key, produtos: [] });
            }
            mapa.get(key).produtos.push(p);
        });

        state.grupos = Array.from(mapa.values())
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map((g) => ({ ...g, total: g.produtos.length }));
    }

    /**
     * Garante que state.grupo (que pode ter vindo do localStorage)
     * corresponde a um grupo real. Se não corresponder, redefine ''.
     */
    function reconciliarGrupoSelecionado() {
        if (!state.grupo) return;
        const keyAlvo = normalizar(state.grupo);
        const existe = state.grupos.some((g) => g.nomeKey === keyAlvo);
        if (!existe) {
            state.grupo = '';
            persistir();
        }
    }

    /* ============================================================
       TELA 3 — Grupo
       ============================================================ */
    function renderGrupos() {
        const box = $('#listaGrupos');
        box.innerHTML = '';

        const catLabel = state.categoria ? state.categoria : 'Todas as categorias';
        $('#categoriaSelecionadaLabel').textContent =
            `Empresa: ${state.empresa} • Categoria: ${catLabel}`;

        if (!state.grupos.length) {
            box.innerHTML = '<p class="muted">Nenhum grupo encontrado para esta combinação.</p>';
            return;
        }

        const todosTotal = state.grupos.reduce((s, g) => s + g.total, 0);
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'card card--all';
        allBtn.innerHTML = `<i class="fas fa-layer-group"></i> Todos os grupos (${todosTotal} ${todosTotal === 1 ? 'item' : 'itens'})`;
        allBtn.addEventListener('click', () => selecionarGrupo(''));
        box.appendChild(allBtn);

        state.grupos.forEach((g) => {
            const respondidos = g.produtos.filter((p) => state.respostas[codigoDe(p)]).length;
            const completo = respondidos === g.total;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card card--grupo' + (completo ? ' is-done' : '');
            if (g.nomeKey === normalizar(state.grupo)) btn.classList.add('selected');

            const qtdTexto = completo
                ? `<i class="fas fa-check-circle"></i> ${g.total} ${g.total === 1 ? 'item respondido' : 'itens respondidos'}`
                : `<i class="fas fa-list"></i> ${g.total} ${g.total === 1 ? 'item' : 'itens'}`;

            btn.innerHTML = `
                <span class="card__nome">${g.nome}</span>
                <span class="card__qtd">${qtdTexto}</span>
            `;

            btn.addEventListener('click', () => selecionarGrupo(g.nome));
            box.appendChild(btn);
        });

        const busca = $('#buscaGrupo');
        busca.value = '';
        busca.oninput = () => {
            const t = normalizar(busca.value);
            Array.from(box.children).forEach((el) => {
                el.hidden = !normalizar(el.textContent).includes(t);
            });
        };
    }

    function selecionarGrupo(grupo) {
        state.grupo = grupo || '';
        persistir();
        renderGrupoAtual();
        irPara(STEPS.PRODUTOS);
    }

    /* ============================================================
       TELA 4 — Produtos (sem paginação)
       ============================================================ */
    /**
     * Retorna os produtos que devem aparecer na tela atual.
     * - Se state.grupo === '', retorna TODOS os produtos.
     * - Se state.grupo está definido, busca o grupo pela chave normalizada.
     * - Fallback: se não encontrar (por qualquer motivo), retorna todos,
     *   evitando a tela vazia silenciosa.
     */
    function produtosDoGrupoAtual() {
        if (!state.grupo) return state.produtos;

        const keyAlvo = normalizar(state.grupo);
        const g = state.grupos.find((x) => x.nomeKey === keyAlvo);

        if (g && g.produtos.length) return g.produtos;

        // Fallback defensivo: filtra direto da lista plana
        const filtrados = state.produtos.filter(
            (p) => normalizar(p.GRUPO) === keyAlvo
        );
        if (filtrados.length) return filtrados;

        // Último recurso: devolve tudo (evita tela vazia silenciosa)
        return state.produtos;
    }

    function renderGrupoAtual() {
        const lista = produtosDoGrupoAtual();
        const nomeGrupo = state.grupo || 'Todos os grupos';

        $('#grupoAtualLabel').textContent = `Grupo: ${nomeGrupo}`;
        $('#grupoAtualContador').textContent =
            `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`;

        const box = $('#listaProdutos');
        box.innerHTML = '';

        if (!lista.length) {
            box.innerHTML = '<p class="muted">Nenhum produto disponível neste grupo.</p>';
        } else {
            lista.forEach((p) => box.appendChild(renderProduto(p)));
        }

        atualizarContadores();
    }

    function renderProduto(p) {
        const codigo = codigoDe(p);
        const nome   = String(p.PRODUTO || '');
        const resp   = state.respostas[codigo] || {};

        const el = document.createElement('article');
        el.className = 'product';
        el.dataset.codigo = codigo;

        if (resp.status === STATUS.OK)  el.classList.add('is-ok');
        if (resp.status === STATUS.NOK) el.classList.add('is-nok');

        el.innerHTML = `
            <div class="product__header">
                <div class="product__info">
                    <span class="product__codigo">${codigo}</span>
                    <div class="product__nome">${nome}</div>
                    <div class="product__tags">
                        <span class="tag tag--cat">${p.CATEGORIA || '—'}</span>
                        <span class="tag tag--grupo">${p.GRUPO || '—'}</span>
                        <span class="tag tag--tipo">${p.TIPO || '—'}</span>
                    </div>
                </div>
            </div>
            <div class="product__actions">
                <button type="button" class="btn btn--success btn-ok">
                    <i class="fas fa-check"></i> COM ESTOQUE
                </button>
                <button type="button" class="btn btn--danger btn-nok">
                    <i class="fas fa-times"></i> SEM ESTOQUE
                </button>
            </div>
            ${resp.status === STATUS.NOK && resp.motivo
                ? `<div class="product__motivo"><i class="fas fa-exclamation-triangle"></i> ${resp.motivo}</div>`
                : ''}
        `;

        el.querySelector('.btn-ok').addEventListener('click', () => {
            state.respostas[codigo] = { status: STATUS.OK, motivo: '' };
            persistir();
            atualizarProduto(el, codigo);
            atualizarContadores();
        });

        el.querySelector('.btn-nok').addEventListener('click', () => {
            abrirModalMotivo(p, (motivo) => {
                state.respostas[codigo] = { status: STATUS.NOK, motivo };
                persistir();
                atualizarProduto(el, codigo);
                atualizarContadores();
            });
        });

        return el;
    }

    function atualizarProduto(el, codigo) {
        const resp = state.respostas[codigo] || {};
        el.classList.remove('is-ok', 'is-nok');
        if (resp.status === STATUS.OK)  el.classList.add('is-ok');
        if (resp.status === STATUS.NOK) el.classList.add('is-nok');

        const old = el.querySelector('.product__motivo');
        if (old) old.remove();

        if (resp.status === STATUS.NOK && resp.motivo) {
            const div = document.createElement('div');
            div.className = 'product__motivo';
            div.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${resp.motivo}`;
            el.appendChild(div);
        }
    }

    function atualizarContadores() {
        const lista = produtosDoGrupoAtual();
        const total = lista.length;
        const respondidos = lista.filter((p) => state.respostas[codigoDe(p)]).length;
        $('#contadorRespondidos').textContent = respondidos;
        $('#contadorTotal').textContent = total;
    }

    /* ---------- Modal de motivo ---------- */
    function abrirModalMotivo(produto, callback) {
        const modal = $('#modalMotivo');
        $('#modalProdutoNome').textContent = `${codigoDe(produto)} — ${produto.PRODUTO || ''}`;

        const box = $('#modalMotivos');
        box.innerHTML = '';
        MOTIVOS.forEach((motivo) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'motivo-btn';
            btn.innerHTML = `<i class="fas fa-circle-exclamation"></i> ${motivo}`;
            btn.addEventListener('click', () => {
                fecharModal();
                callback(motivo);
            });
            box.appendChild(btn);
        });

        modal.hidden = false;
    }

    function fecharModal() {
        $('#modalMotivo').hidden = true;
    }

    /* ============================================================
       TELA 5 — Resumo
       ============================================================ */
    function montarResumo() {
        const total = state.produtos.length;
        const respondidos = Object.keys(state.respostas).length;
        let ok = 0, nok = 0;
        const porMotivo = {};
        MOTIVOS.forEach((m) => { porMotivo[m] = 0; });

        Object.values(state.respostas).forEach((r) => {
            if (r.status === STATUS.OK) ok++;
            else if (r.status === STATUS.NOK) {
                nok++;
                if (porMotivo[r.motivo] !== undefined) porMotivo[r.motivo]++;
            }
        });

        const catLabel = state.categoria || 'Todas';
        const grupoLabel = state.grupo || 'Todos';

        const box = $('#resumoBox');
        box.innerHTML = `
            <div class="resumo__card">
                <div class="resumo__linha"><span>Usuário</span><strong>${state.usuario || '—'}</strong></div>
                <div class="resumo__linha"><span>Empresa</span><strong>${state.empresa || '—'}</strong></div>
                <div class="resumo__linha"><span>Categoria</span><strong>${catLabel}</strong></div>
                <div class="resumo__linha"><span>Grupo</span><strong>${grupoLabel}</strong></div>
                <div class="resumo__linha"><span>Total de produtos</span><strong>${total}</strong></div>
                <div class="resumo__linha"><span>Respondidos</span><strong>${respondidos}</strong></div>
                ${respondidos < total
                    ? `<div class="resumo__linha" style="color:var(--warning)"><i class="fas fa-exclamation-triangle"></i>&nbsp;Atenção: ${total - respondidos} item(ns) não respondido(s)</div>`
                    : ''}
            </div>

            <div class="resumo__card">
                <div class="resumo__linha resumo__ok"><span><i class="fas fa-check-circle" style="color:var(--success)"></i> COM ESTOQUE</span><strong>${ok}</strong></div>
                <div class="resumo__linha resumo__nok"><span><i class="fas fa-times-circle" style="color:var(--danger)"></i> SEM ESTOQUE</span><strong>${nok}</strong></div>

                <div class="resumo__motivos">
                    ${MOTIVOS.map((m) => `
                        <div class="resumo__motivo"><span>${m}</span><span>${porMotivo[m]}</span></div>
                    `).join('')}
                </div>
            </div>
        `;

        $('#btnEnviar').disabled = respondidos === 0 || state.enviado;
        $('#btnNovaConferencia').hidden = !state.enviado;
    }

    /* ============================================================
       Envio
       ============================================================ */
    async function enviar() {
        if (state.enviado) return;

        const respondidos = Object.keys(state.respostas).length;
        if (respondidos === 0) {
            UI.toast('Responda ao menos um item antes de enviar.', 'error');
            return;
        }

        const { data, hora } = agora();
        const payload = state.produtos
            .filter((p) => state.respostas[codigoDe(p)])
            .map((p) => {
                const codigo = codigoDe(p);
                const r = state.respostas[codigo];
                return {
                    EMPRESA:   state.empresa,
                    CODIGO:    codigo,
                    PRODUTO:   p.PRODUTO   || '',
                    CATEGORIA: p.CATEGORIA || '',
                    GRUPO:     p.GRUPO     || '',
                    SUBGRUPO:  p.SUBGRUPO  || '',
                    TIPO:      p.TIPO      || '',
                    USUARIO:   state.usuario,
                    STATUS:    r.status,
                    MOTIVO:    r.motivo || '',
                    DATA:      data,
                    HORA:      hora
                };
            });

        if (!confirm(`Enviar ${payload.length} resposta(s) para a planilha?`)) return;

        UI.loading('Enviando respostas...');
        $('#btnEnviar').disabled = true;

        try {
            const resp = await API.salvarRespostas(payload);
            if (!resp.sucesso) throw new Error(resp.mensagem || 'Falha ao salvar.');

            state.enviado = true;
            persistir();

            UI.toast(`✔ ${payload.length} resposta(s) enviada(s) com sucesso!`, 'success');

            $('#resumoBox').innerHTML = `
                <div class="sucesso">
                    <i class="fas fa-check-circle"></i>
                    <h3>Respostas enviadas!</h3>
                    <p>${payload.length} item(ns) registrado(s) na planilha.</p>
                </div>
            `;
            $('#btnEnviar').hidden = true;
            $('#btnNovaConferencia').hidden = false;
        } catch (e) {
            UI.toast('Erro ao enviar: ' + e.message, 'error');
            $('#btnEnviar').disabled = false;
        } finally {
            UI.hideLoading();
        }
    }

    /* ============================================================
       Nova conferência
       ============================================================ */
    function novaConferencia() {
        Object.assign(state, {
            empresa: '',
            categoria: '',
            grupo: '',
            produtos: [],
            grupos: [],
            respostas: {},
            enviado: false
        });
        Storage.limparEstado();
        $('#btnEnviar').hidden = false;
        $('#btnEnviar').disabled = false;
        $('#listaEmpresas').innerHTML = '';
        $('#listaCategorias').innerHTML = '';
        $('#listaGrupos').innerHTML = '';
        carregarEmpresas();
        irPara(STEPS.EMPRESA);
    }

    /* ============================================================
       Bind geral
       ============================================================ */
    function bindEventos() {
        $$('[data-voltar]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const atual = Number(document.querySelector('.step:not([hidden])').dataset.step);

                if (atual === STEPS.PRODUTOS && Object.keys(state.respostas).length > 0) {
                    if (!confirm('Voltar descarta as respostas desta rodada. Continuar?')) return;
                    state.respostas = {};
                }

                if (atual === STEPS.GRUPO) {
                    state.produtos = [];
                    state.grupos = [];
                    state.grupo = '';
                    state.respostas = {};
                }

                irPara(atual - 1);

                // Ao voltar para a tela de grupos, re-renderiza a lista
                if (atual - 1 === STEPS.GRUPO) renderGrupos();
            });
        });

        $$('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharModal));

        $('#btnIrParaResumo').addEventListener('click', () => {
            const lista = produtosDoGrupoAtual();
            const respondidos = lista.filter((p) => state.respostas[codigoDe(p)]).length;
            if (respondidos < lista.length) {
                if (!confirm(`${lista.length - respondidos} item(ns) deste grupo ainda não respondido(s). Deseja continuar mesmo assim?`)) return;
            }
            montarResumo();
            irPara(STEPS.RESUMO);
        });

        $('#btnEnviar').addEventListener('click', enviar);
        $('#btnNovaConferencia').addEventListener('click', novaConferencia);

        $('#btnUsuario').addEventListener('click', () => {
            if (!confirm('Trocar de usuário? O progresso atual será mantido.')) return;
            irPara(STEPS.USUARIO);
        });

        window.addEventListener('beforeunload', (e) => {
            if (!state.enviado && Object.keys(state.respostas).length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    /* ============================================================
       Init
       ============================================================ */
    async function iniciar() {
        const saved = restaurar();
        atualizarLabelUsuario();
        initUsuario();
        bindEventos();

        if (saved && saved.usuario) {
            if (saved.empresa) {
                await carregarEmpresas();
                await carregarCategorias(saved.empresa);

                // Só carrega produtos se categoria já foi escolhida
                if (saved.categoria !== undefined && saved.categoria !== null) {
                    await carregarProdutos();
                    renderGrupos();

                    if (saved.grupo) {
                        renderGrupoAtual();
                        irPara(STEPS.PRODUTOS);
                    } else {
                        irPara(STEPS.GRUPO);
                    }
                } else {
                    irPara(STEPS.CATEGORIA);
                }
            } else {
                await carregarEmpresas();
                irPara(STEPS.EMPRESA);
            }
        } else {
            irPara(STEPS.USUARIO, { salvarEstado: false });
        }
    }

    return { iniciar };
})();