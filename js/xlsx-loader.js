/* ============================================================
   xlsx-loader.js — Leitura da planilha local dados/FORMS.xlsx
   ============================================================ */

const XLSXLoader = (() => {
    const ARQUIVO = 'dados/FORMS.xlsx';

    let _cache = null;
    let _carregando = null;

    function normalizar(str) {
        return String(str == null ? '' : str)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();
    }

    async function carregar() {
        if (_cache) return _cache;
        if (_carregando) return _carregando;

        _carregando = (async () => {
            if (typeof XLSX === 'undefined') {
                throw new Error('SheetJS (XLSX) não carregado. Verifique a CDN.');
            }

            const resp = await fetch(ARQUIVO, { cache: 'no-cache' });
            if (!resp.ok) throw new Error(`Falha ao carregar ${ARQUIVO} (HTTP ${resp.status})`);

            const buffer = await resp.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });

            if (!workbook.SheetNames || !workbook.SheetNames.length) {
                throw new Error('XLSX sem abas.');
            }

            const primeiraAba = workbook.SheetNames[0];
            const sheet = workbook.Sheets[primeiraAba];

            const linhas = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                raw: false,
                defval: ''
            });

            if (!linhas.length) throw new Error('XLSX vazio.');

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

            _cache = registros;
            return registros;
        })();

        try {
            return await _carregando;
        } finally {
            _carregando = null;
        }
    }

    async function getEmpresas() {
        const registros = await carregar();
        const set = new Set();
        registros.forEach((r) => {
            const emp = String(r.EMPRESA || '').trim();
            if (emp) set.add(emp);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    async function getCategoriasPorEmpresa(empresa) {
        if (!empresa) throw new Error('Parâmetro "empresa" obrigatório.');
        const alvo = normalizar(empresa);
        const registros = await carregar();

        const set = new Set();
        registros.forEach((r) => {
            if (normalizar(r.EMPRESA) !== alvo) return;
            const cat = String(r.CATEGORIA || '').trim();
            if (cat) set.add(cat);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    async function getProdutosPorEmpresaCategoria(empresa, categoria) {
        if (!empresa) throw new Error('Parâmetro "empresa" obrigatório.');
        const empAlvo = normalizar(empresa);
        const catAlvo = normalizar(categoria || '');
        const registros = await carregar();

        return registros
            .filter((r) => {
                if (normalizar(r.EMPRESA) !== empAlvo) return false;
                if (catAlvo && normalizar(r.CATEGORIA) !== catAlvo) return false;
                return true;
            })
            .map((r) => ({
                EMPRESA:     String(r.EMPRESA     || '').trim(),
                'Codigo C5': String(r['Codigo C5']|| '').trim(),
                CODIGO:      String(r['Codigo C5']|| '').trim(),
                PRODUTO:     String(r.PRODUTO     || '').trim(),
                CATEGORIA:   String(r.CATEGORIA   || '').trim(),
                GRUPO:       String(r.GRUPO       || '').trim(),
                SUBGRUPO:    String(r.SUBGRUPO    || '').trim(),
                TIPO:        String(r.TIPO        || '').trim()
            }));
    }

    function limparCache() { _cache = null; }

    return {
        carregar,
        getEmpresas,
        getCategoriasPorEmpresa,
        getProdutosPorEmpresaCategoria,
        limparCache
    };
})();

window.XLSXLoader = XLSXLoader;