// ============================================================
// BASE DE DATOS SQLITE — RAMSONS CONFERÊNCIA
// Parte 1/2 — Esquema, produtos e catálogo
// ============================================================

import * as SQLite from 'expo-sqlite';
import * as XLSX from 'xlsx';

import type {
  Conferencia,
  DadosProdutoRapido,
  LeituraConferencia,
  Produto,
  ProdutoImportacao,
  ResumoConferencia,
  ResumoRevisao,
  StatusConferencia,
  StatusLeitura,
  StatusRevisao,
  TipoProduto,
} from '@/models/produto';

import produtosRamsons from '@/assets/data/produtos-ramsons.json';

// Nombre del archivo de base de datos local.
const DATABASE_NAME = 'ramsons_conferencia.db';

// Conexión reutilizable.
let database: SQLite.SQLiteDatabase | null = null;

// ============================================================
// OBTENER CONEXIÓN
// ============================================================

async function obterDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return database;
  }

  database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  return database;
}

// ============================================================
// FORMATAR NÚMERO DE CONFERENCIA
// ============================================================

export function formatarNumeroConferencia(id: number): string {
  return `#${String(id).padStart(6, '0')}`;
}

// ============================================================
// GERAR CÓDIGO INTERNO PARA PRODUTOS NOVOS
// ============================================================

function gerarCodigoInternoManual(): string {
  return `MAN-${Date.now()}`;
}

function gerarCodigoInternoDesconhecido(codigoBarras: string): string {
  return `DESC-${codigoBarras}`;
}

// ============================================================
// INICIALIZAR BASE DE DATOS
// Crea TODAS las tablas e índices de la aplicación.
// Debe ejecutarse una única vez, antes de cualquier consulta.
// ============================================================

export async function inicializarDatabase(): Promise<void> {
  const db = await obterDatabase();

  // ----------------------------------------------------------
  // PRODUTOS
  // ----------------------------------------------------------

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS produtos (
      codigo_interno TEXT PRIMARY KEY NOT NULL,
      codigo_barras TEXT UNIQUE,
      nome TEXT NOT NULL,
      marca TEXT,
      categoria TEXT,
      modelo TEXT,
      unidade TEXT,
      estoque INTEGER DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      url TEXT,
      especificacoes TEXT,
      origem TEXT NOT NULL DEFAULT 'catalogo'
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras
    ON produtos(codigo_barras);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_produtos_nome
    ON produtos(nome);
  `);

  // ----------------------------------------------------------
  // CONFERÊNCIAS (SESSÕES)
  // ----------------------------------------------------------

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conferencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      data_inicio TEXT NOT NULL,
      data_fim TEXT,
      status TEXT NOT NULL DEFAULT 'em_andamento'
    );
  `);

  // ----------------------------------------------------------
  // LEITURAS DE CONFERÊNCIA
  // ----------------------------------------------------------

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS leituras_conferencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conferencia_id INTEGER NOT NULL,
      codigo_interno TEXT NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 0,
      primeira_leitura TEXT NOT NULL,
      ultima_leitura TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'normal',
      FOREIGN KEY (conferencia_id) REFERENCES conferencias(id),
      FOREIGN KEY (codigo_interno) REFERENCES produtos(codigo_interno),
      UNIQUE (conferencia_id, codigo_interno)
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_leituras_conferencia_id
    ON leituras_conferencia(conferencia_id);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_leituras_codigo_interno
    ON leituras_conferencia(codigo_interno);
  `);

  // Migração: adiciona status_revisao se ainda não existir.
  const colStatusRevisao = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('leituras_conferencia') WHERE name = 'status_revisao';`,
  );
  if (!colStatusRevisao || colStatusRevisao.cnt === 0) {
    await db.execAsync(`
      ALTER TABLE leituras_conferencia
      ADD COLUMN status_revisao TEXT NOT NULL DEFAULT 'pendente';
    `);
  }

  // Migração: adiciona descricao em produtos se ainda não existir.
  const colDescricao = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = 'descricao';`,
  );
  if (!colDescricao || colDescricao.cnt === 0) {
    await db.execAsync(`ALTER TABLE produtos ADD COLUMN descricao TEXT;`);
  }

  // Migração: ar condicionado — flag e código COND em produtos.
  const colEsAr = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = 'es_ar_acondicionado';`,
  );
  if (!colEsAr || colEsAr.cnt === 0) {
    await db.execAsync(
      `ALTER TABLE produtos ADD COLUMN es_ar_acondicionado INTEGER NOT NULL DEFAULT 0;`,
    );
  }

  const colBarrasCond = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = 'codigo_barras_cond';`,
  );
  if (!colBarrasCond || colBarrasCond.cnt === 0) {
    await db.execAsync(
      `ALTER TABLE produtos ADD COLUMN codigo_barras_cond TEXT;`,
    );
  }

  // Migração: tipo_produto — substitui es_ar_acondicionado (boolean) por tipo textual.
  const colTipoProduto = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = 'tipo_produto';`,
  );
  if (!colTipoProduto || colTipoProduto.cnt === 0) {
    await db.execAsync(
      `ALTER TABLE produtos ADD COLUMN tipo_produto TEXT NOT NULL DEFAULT 'normal';`,
    );
    await db.execAsync(
      `UPDATE produtos SET tipo_produto = 'evaporadora' WHERE es_ar_acondicionado = 1;`,
    );
  }

  // Migração: codigo_par — campo livre de vinculação entre evaporadora e condensadora.
  const colCodigoPar = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = 'codigo_par';`,
  );
  if (!colCodigoPar || colCodigoPar.cnt === 0) {
    await db.execAsync(
      `ALTER TABLE produtos ADD COLUMN codigo_par TEXT;`,
    );
  }

  // ----------------------------------------------------------
  // CONFIGURAÇÕES (chave/valor)
  // ----------------------------------------------------------

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL
    );
  `);
}

// ============================================================
// LER / SALVAR UMA CONFIGURAÇÃO
// ============================================================

export async function obterConfiguracao(
  chave: string,
  valorPadrao: string,
): Promise<string> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<{ valor: string }>(
    `SELECT valor FROM configuracoes WHERE chave = ? LIMIT 1;`,
    chave,
  );

  return resultado?.valor ?? valorPadrao;
}

export async function salvarConfiguracao(
  chave: string,
  valor: string,
): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      INSERT INTO configuracoes (chave, valor)
      VALUES (?, ?)
      ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor;
    `,
    chave,
    valor,
  );
}

// ============================================================
// CONVERTIR SQLITE → PRODUTO
// ============================================================

type ProdutoSQLite = {
  codigo_interno: string;
  codigo_barras: string | null;
  codigo_par: string | null;
  nome: string;
  marca: string | null;
  categoria: string | null;
  modelo: string | null;
  descricao: string | null;
  ativo: number;
  origem: string;
  es_ar_acondicionado: number;
  tipo_produto: string;
};

function converterProduto(produto: ProdutoSQLite): Produto {
  return {
    codigoInterno: produto.codigo_interno,
    codigoBarras: produto.codigo_barras ?? '',
    codigoPar: produto.codigo_par ?? undefined,
    nome: produto.nome,
    marca: produto.marca ?? undefined,
    categoria: produto.categoria ?? undefined,
    modelo: produto.modelo ?? undefined,
    descricao: produto.descricao ?? undefined,
    ativo: produto.ativo === 1,
    origem: (produto.origem as Produto['origem']) ?? 'catalogo',
    tipoProduto: (produto.tipo_produto as TipoProduto) ?? 'normal',
  };
}

// ============================================================
// ADICIONAR PRODUTO
// ============================================================

async function adicionarProduto(produto: Produto): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      INSERT INTO produtos (
        codigo_interno,
        codigo_barras,
        nome,
        marca,
        categoria,
        modelo,
        descricao,
        ativo,
        origem,
        tipo_produto,
        codigo_par
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    produto.codigoInterno,
    produto.codigoBarras || null,
    produto.nome,
    produto.marca ?? null,
    produto.categoria ?? null,
    produto.modelo ?? null,
    produto.descricao ?? null,
    produto.ativo ? 1 : 0,
    produto.origem,
    produto.tipoProduto ?? 'normal',
    produto.codigoPar ?? null,
  );
}

// ============================================================
// BUSCAR POR CÓDIGO DE BARRAS
// ============================================================

export async function buscarPorCodigoBarras(
  codigoBarras: string,
): Promise<Produto | undefined> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<ProdutoSQLite>(
    `
      SELECT *
      FROM produtos
      WHERE codigo_barras = ?
        AND ativo = 1
      LIMIT 1;
    `,
    codigoBarras,
  );

  if (!resultado) {
    return undefined;
  }

  return converterProduto(resultado);
}

// ============================================================
// BUSCAR POR CÓDIGO INTERNO
// ============================================================

export async function buscarPorCodigoInterno(
  codigoInterno: string,
): Promise<Produto | undefined> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<ProdutoSQLite>(
    `
      SELECT *
      FROM produtos
      WHERE codigo_interno = ?
        AND ativo = 1
      LIMIT 1;
    `,
    codigoInterno,
  );

  if (!resultado) {
    return undefined;
  }

  return converterProduto(resultado);
}

// ============================================================
// BUSCAR PRODUTOS (texto livre)
// ============================================================

export async function buscarProdutos(termo: string): Promise<Produto[]> {
  const db = await obterDatabase();

  const termoBusca = `%${termo.trim()}%`;

  const resultados = await db.getAllAsync<ProdutoSQLite>(
    `
      SELECT *
      FROM produtos
      WHERE ativo = 1
        AND (
          codigo_interno LIKE ? COLLATE NOCASE
          OR codigo_barras LIKE ? COLLATE NOCASE
          OR nome LIKE ? COLLATE NOCASE
        )
      ORDER BY nome COLLATE NOCASE ASC
      LIMIT 100;
    `,
    termoBusca,
    termoBusca,
    termoBusca,
  );

  return resultados.map(converterProduto);
}

// ============================================================
// OBTENER TODOS LOS PRODUCTOS
// ============================================================

export async function obterProdutos(): Promise<Produto[]> {
  const db = await obterDatabase();

  const resultados = await db.getAllAsync<ProdutoSQLite>(`
    SELECT *
    FROM produtos
    WHERE ativo = 1
    ORDER BY nome COLLATE NOCASE ASC;
  `);

  return resultados.map(converterProduto);
}

// ============================================================
// ACTUALIZAR PRODUCTO
// ============================================================

// codigoBarras é IMUTÁVEL — nunca é atualizado.
// codigoInterno PODE ser alterado; codigoInternoOriginal identifica
// o registro atual na BD e é propagado a leituras_conferencia.
export async function atualizarProduto(
  produto: Produto,
  codigoInternoOriginal: string,
): Promise<boolean> {
  const db = await obterDatabase();

  try {
    await db.withTransactionAsync(async () => {
      if (produto.codigoInterno !== codigoInternoOriginal) {
        await db.runAsync(
          `UPDATE leituras_conferencia
           SET codigo_interno = ?
           WHERE codigo_interno = ?;`,
          produto.codigoInterno,
          codigoInternoOriginal,
        );
      }

      await db.runAsync(
        `UPDATE produtos
         SET
           codigo_interno = ?,
           nome = ?,
           marca = ?,
           categoria = ?,
           modelo = ?,
           descricao = ?,
           tipo_produto = ?,
           codigo_par = ?
         WHERE codigo_interno = ?;`,
        produto.codigoInterno,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.descricao ?? null,
        produto.tipoProduto ?? 'normal',
        produto.codigoPar ?? null,
        codigoInternoOriginal,
      );
    });

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// DESACTIVAR PRODUCTO
// ============================================================

export async function removerProduto(
  codigoInterno: string,
): Promise<boolean> {
  const db = await obterDatabase();

  const resultado = await db.runAsync(
    `
      UPDATE produtos
      SET ativo = 0, codigo_barras = NULL
      WHERE codigo_interno = ?;
    `,
    codigoInterno,
  );

  return resultado.changes > 0;
}

// ============================================================
// CONTAR PRODUCTOS ACTIVOS
// ============================================================

export async function contarProdutos(): Promise<number> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<{ total: number }>(`
    SELECT COUNT(*) AS total
    FROM produtos
    WHERE ativo = 1;
  `);

  return resultado?.total ?? 0;
}

// ============================================================
// CONTAR PRODUTOS POR ORIGEM
// ============================================================

export async function contarProdutosPorOrigem(): Promise<{
  catalogo: number;
  manual: number;
  desconhecido: number;
}> {
  const db = await obterDatabase();

  const resultados = await db.getAllAsync<{
    origem: string;
    total: number;
  }>(`
    SELECT origem, COUNT(*) AS total
    FROM produtos
    WHERE ativo = 1
    GROUP BY origem;
  `);

  const contagem = { catalogo: 0, manual: 0, desconhecido: 0 };

  for (const item of resultados) {
    if (item.origem === 'catalogo') contagem.catalogo = item.total;
    else if (item.origem === 'manual') contagem.manual = item.total;
    else if (item.origem === 'desconhecido')
      contagem.desconhecido = item.total;
  }

  return contagem;
}

// ============================================================
// IMPORTAR CATÁLOGO REAL RAMSONS (primeira vez)
// Se ejecuta solamente si la base está vacía.
// ============================================================

export async function importarProdutosRamsons(): Promise<number> {
  const total = await contarProdutos();

  if (total > 0) {
    return 0;
  }

  const db = await obterDatabase();

  const lista = produtosRamsons as ProdutoImportacao[];

  await db.withTransactionAsync(async () => {
    for (const produto of lista) {
      await db.runAsync(
        `
          INSERT OR IGNORE INTO produtos (
            codigo_interno,
            codigo_barras,
            nome,
            marca,
            categoria,
            modelo,
            descricao,
            origem
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'catalogo');
        `,
        produto.codigoInterno,
        produto.codigoBarras || null,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.descricao ?? null,
      );
    }
  });

  await salvarConfiguracao('catalogo_atualizado_em', new Date().toISOString());

  return lista.length;
}

// ============================================================
// REIMPORTAR CATÁLOGO EMBUTIDO (via Configurações)
// Substitui somente produtos com origem='catalogo'.
// Produtos 'manual' e 'desconhecido' — incluindo os que você
// editou pela tela de Consultar produto — não são afetados.
// ============================================================

export async function reimportarCatalogoEmbutido(): Promise<number> {
  const db = await obterDatabase();

  const lista = produtosRamsons as ProdutoImportacao[];

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM produtos WHERE origem = 'catalogo';`);

    for (const produto of lista) {
      await db.runAsync(
        `
          INSERT OR IGNORE INTO produtos (
            codigo_interno,
            codigo_barras,
            nome,
            marca,
            categoria,
            modelo,
            descricao,
            origem
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'catalogo');
        `,
        produto.codigoInterno,
        produto.codigoBarras || null,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.descricao ?? null,
      );
    }
  });

  await salvarConfiguracao('catalogo_atualizado_em', new Date().toISOString());

  return lista.length;
}

// ============================================================
// IMPORTAR CATÁLOGO DE ARQUIVO EXTERNO (JSON do dispositivo)
// Substitui somente produtos com origem='catalogo'.
// Retorna a quantidade de produtos importados.
// Lança erro com mensagem legível se o arquivo for inválido.
// ============================================================

export async function importarCatalogoExterno(
  jsonTexto: string,
): Promise<number> {
  let lista: ProdutoImportacao[];

  try {
    const parsed: unknown = JSON.parse(jsonTexto);

    if (!Array.isArray(parsed)) {
      throw new Error('O arquivo deve conter um array JSON de produtos.');
    }

    // Valida que cada item tem pelo menos codigoInterno e nome.
    for (const item of parsed) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>).codigoInterno !== 'string' ||
        typeof (item as Record<string, unknown>).nome !== 'string'
      ) {
        throw new Error(
          'Formato inválido: cada produto precisa de "codigoInterno" e "nome".',
        );
      }
    }

    lista = parsed as ProdutoImportacao[];
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : 'Arquivo JSON inválido.',
    );
  }

  if (lista.length === 0) {
    throw new Error('O arquivo não contém nenhum produto.');
  }

  const db = await obterDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM produtos WHERE origem = 'catalogo';`);

    for (const produto of lista) {
      await db.runAsync(
        `
          INSERT OR IGNORE INTO produtos (
            codigo_interno,
            codigo_barras,
            nome,
            marca,
            categoria,
            modelo,
            descricao,
            tipo_produto,
            codigo_par,
            origem
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'catalogo');
        `,
        produto.codigoInterno,
        produto.codigoBarras || null,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.descricao ?? null,
        produto.tipoProduto ?? 'normal',
        produto.codigoPar ?? null,
      );
    }
  });

  await salvarConfiguracao('catalogo_atualizado_em', new Date().toISOString());

  return lista.length;
}

// ============================================================
// IMPORTAR CATÁLOGO DE EXCEL (.xlsx)
// Espera planilha com colunas "codigo de barras" e "nome"
// (case-insensitive, qualquer ordem).
// ============================================================

export async function importarCatalogoExcel(base64: string): Promise<number> {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Arquivo Excel vazio.');

  const sheet = workbook.Sheets[sheetName];
  const linhas = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (linhas.length < 2) throw new Error('Planilha sem dados.');

  const cabecalho = linhas[0].map((c) =>
    String(c ?? '').toLowerCase().trim(),
  );

  function acharColuna(...nomes: string[]): number {
    for (const nome of nomes) {
      const idx = cabecalho.findIndex((h) => h.includes(nome));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const colBarras = acharColuna('codigo de barras', 'código de barras', 'barras', 'barcode', 'ean', 'codigo_barras');
  const colNome   = acharColuna('nome', 'name', 'produto', 'descripcion', 'descripción', 'descricao');

  if (colBarras < 0) throw new Error('Coluna de código de barras não encontrada.');
  if (colNome < 0)   throw new Error('Coluna de nome não encontrada.');

  const produtos: { codigoBarras: string; nome: string }[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const barras = String(linha[colBarras] ?? '').trim();
    const nome   = String(linha[colNome]   ?? '').trim();
    if (!barras || !nome) continue;
    produtos.push({ codigoBarras: barras, nome });
  }

  if (produtos.length === 0) throw new Error('Nenhum produto válido encontrado.');

  const db = await obterDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM produtos WHERE origem = 'catalogo';`);

    for (const p of produtos) {
      await db.runAsync(
        `INSERT OR IGNORE INTO produtos
           (codigo_interno, codigo_barras, nome, tipo_produto, origem)
         VALUES (?, ?, ?, 'normal', 'catalogo');`,
        p.codigoBarras,
        p.codigoBarras,
        p.nome,
      );
    }
  });

  await salvarConfiguracao('catalogo_atualizado_em', new Date().toISOString());

  return produtos.length;
}

// ============================================================
// EXPORTAR CATÁLOGO COMPLETO (backup do dispositivo)
// Retorna um JSON com TODOS os produtos (todas as origens)
// no mesmo formato aceito por importarCatalogoExterno.
// ============================================================

// ============================================================
// EXPORTAR CATÁLOGO PARA EXCEL (.xlsx)
// Retorna base64 do arquivo para ser salvo e compartilhado.
// ============================================================

export async function exportarCatalogoExcel(): Promise<string> {
  const db = await obterDatabase();

  const rows = await db.getAllAsync<{
    codigo_interno: string;
    codigo_barras: string | null;
    nome: string;
    marca: string | null;
    categoria: string | null;
    modelo: string | null;
    descricao: string | null;
    tipo_produto: string;
    codigo_par: string | null;
    origem: string;
  }>(`
    SELECT codigo_interno, codigo_barras, nome, marca, categoria, modelo,
           descricao, tipo_produto, codigo_par, origem
    FROM produtos
    WHERE ativo = 1
    ORDER BY nome COLLATE NOCASE ASC;
  `);

  const dados = rows.map((r) => ({
    'Código Interno': r.codigo_interno,
    'Código de Barras': r.codigo_barras ?? '',
    'Nome': r.nome,
    'Marca': r.marca ?? '',
    'Categoria': r.categoria ?? '',
    'Modelo': r.modelo ?? '',
    'Descrição': r.descricao ?? '',
    'Tipo': r.tipo_produto,
    'Código do Conjunto': r.codigo_par ?? '',
    'Origem': r.origem,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');

  // Ajusta largura das colunas
  worksheet['!cols'] = [
    { wch: 16 }, // Código Interno
    { wch: 18 }, // Código de Barras
    { wch: 40 }, // Nome
    { wch: 18 }, // Marca
    { wch: 18 }, // Categoria
    { wch: 18 }, // Modelo
    { wch: 30 }, // Descrição
    { wch: 14 }, // Tipo
    { wch: 18 }, // Código do Conjunto
    { wch: 12 }, // Origem
  ];

  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
}

export async function exportarCatalogo(): Promise<string> {
  const db = await obterDatabase();

  const rows = await db.getAllAsync<{
    codigo_interno: string;
    codigo_barras: string | null;
    nome: string;
    marca: string | null;
    categoria: string | null;
    modelo: string | null;
    descricao: string | null;
    tipo_produto: string;
    codigo_par: string | null;
  }>(`
    SELECT
      codigo_interno,
      codigo_barras,
      nome,
      marca,
      categoria,
      modelo,
      descricao,
      tipo_produto,
      codigo_par
    FROM produtos
    WHERE ativo = 1
    ORDER BY nome COLLATE NOCASE ASC;
  `);

  const lista: ProdutoImportacao[] = rows.map((r) => ({
    codigoInterno: r.codigo_interno,
    codigoBarras: r.codigo_barras,
    nome: r.nome,
    marca: r.marca,
    categoria: r.categoria,
    modelo: r.modelo,
    descricao: r.descricao,
    tipoProduto: r.tipo_produto !== 'normal' ? r.tipo_produto : undefined,
    codigoPar: r.codigo_par,
  }));

  return JSON.stringify(lista, null, 2);
}

// ============================================================
// CRIAR PRODUTO MANUAL (formulário "Cadastrar produto")
// ============================================================

export type DadosProdutoManual = {
  codigoInterno?: string;
  codigoBarras?: string | null;
  codigoPar?: string;
  nome: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  descricao?: string;
  tipoProduto?: TipoProduto;
};

export async function criarProdutoManual(
  dados: DadosProdutoManual,
): Promise<Produto> {
  const codigoInterno = dados.codigoInterno?.trim() || gerarCodigoInternoManual();

  const produto: Produto = {
    codigoInterno,
    codigoBarras: dados.codigoBarras ?? '',
    codigoPar: dados.codigoPar ?? undefined,
    nome: dados.nome,
    marca: dados.marca,
    categoria: dados.categoria,
    modelo: dados.modelo,
    descricao: dados.descricao,
    ativo: true,
    origem: 'manual',
    tipoProduto: dados.tipoProduto ?? 'normal',
  };

  await adicionarProduto(produto);

  return produto;
}

// ============================================================
// REGISTRAR PRODUTO DESCONHECIDO
// Usa a unidade padrão configurada em Configurações.
// ============================================================

export async function registrarProdutoDesconhecido(
  codigoBarras: string,
): Promise<Produto> {
  const existente = await buscarPorCodigoBarras(codigoBarras);

  if (existente) {
    return existente;
  }

  const db = await obterDatabase();
  const codigoInterno = gerarCodigoInternoDesconhecido(codigoBarras);
  const nome = `Produto não identificado (${codigoBarras})`;

  // UPSERT: se o código_interno já existe (ex: produto removido anteriormente),
  // reativa-o em vez de tentar um INSERT duplicado.
  await db.runAsync(
    `INSERT INTO produtos (codigo_interno, codigo_barras, nome, ativo, origem, tipo_produto)
     VALUES (?, ?, ?, 1, 'desconhecido', 'normal')
     ON CONFLICT(codigo_interno) DO UPDATE SET
       ativo = 1,
       codigo_barras = excluded.codigo_barras,
       origem = 'desconhecido';`,
    codigoInterno,
    codigoBarras,
    nome,
  );

  return {
    codigoInterno,
    codigoBarras,
    nome,
    ativo: true,
    origem: 'desconhecido',
    tipoProduto: 'normal',
  };
}

// ============================================================
// COMPLETAR PRODUTO DESCONHECIDO
// ============================================================

// Retorna o codigoInterno efetivo após a operação
// (pode ter mudado se dados.codigoInterno foi fornecido).
export async function completarProdutoDesconhecido(
  codigoInternoOriginal: string,
  dados: DadosProdutoRapido,
): Promise<string> {
  const db = await obterDatabase();
  const novoCodigoInterno = dados.codigoInterno?.trim() || codigoInternoOriginal;

  await db.withTransactionAsync(async () => {
    if (novoCodigoInterno !== codigoInternoOriginal) {
      await db.runAsync(
        `UPDATE leituras_conferencia
         SET codigo_interno = ?
         WHERE codigo_interno = ?;`,
        novoCodigoInterno,
        codigoInternoOriginal,
      );
    }

    await db.runAsync(
      `UPDATE produtos
       SET
         codigo_interno = ?,
         nome = ?,
         marca = ?,
         categoria = ?,
         modelo = ?,
         descricao = ?,
         tipo_produto = ?,
         codigo_par = ?,
         origem = 'manual'
       WHERE codigo_interno = ?;`,
      novoCodigoInterno,
      dados.nome,
      dados.marca ?? null,
      dados.categoria ?? null,
      dados.modelo ?? null,
      dados.descricao ?? null,
      dados.tipoProduto ?? 'normal',
      dados.codigoPar ?? null,
      codigoInternoOriginal,
    );
  });

  return novoCodigoInterno;
}

// ============================================================
// PARTE 2/2 — Conferências, leituras, exportação, histórico
// e gerenciamento de dados
// ============================================================

// ============================================================
// CRIAR CONFERÊNCIA
// ============================================================

export async function criarConferencia(
  nome?: string,
): Promise<Conferencia> {
  const db = await obterDatabase();

  const agora = new Date().toISOString();
  const nomeLimpo = nome?.trim() || null;

  const resultado = await db.runAsync(
    `
      INSERT INTO conferencias (
        nome,
        data_inicio,
        status
      )
      VALUES (?, ?, 'em_andamento');
    `,
    nomeLimpo,
    agora,
  );

  const id = resultado.lastInsertRowId;

  return {
    id,
    numero: formatarNumeroConferencia(id),
    nome: nomeLimpo ?? formatarNumeroConferencia(id),
    dataInicio: agora,
    status: 'em_andamento',
  };
}

// ============================================================
// OBTER CONFERÊNCIA POR ID
// ============================================================

type ConferenciaSQLite = {
  id: number;
  nome: string | null;
  data_inicio: string;
  data_fim: string | null;
  status: StatusConferencia;
};

function converterConferencia(c: ConferenciaSQLite): Conferencia {
  const numero = formatarNumeroConferencia(c.id);

  return {
    id: c.id,
    numero,
    nome: c.nome?.trim() || numero,
    dataInicio: c.data_inicio,
    dataFim: c.data_fim ?? undefined,
    status: c.status,
  };
}

export async function obterConferencia(
  conferenciaId: number,
): Promise<Conferencia | undefined> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<ConferenciaSQLite>(
    `
      SELECT *
      FROM conferencias
      WHERE id = ?
      LIMIT 1;
    `,
    conferenciaId,
  );

  if (!resultado) {
    return undefined;
  }

  return converterConferencia(resultado);
}

// ============================================================
// LISTAR CONFERÊNCIAS POR STATUS
// ============================================================

export type ConferenciaComContagem = Conferencia & {
  produtosLidos: number;
};

export async function listarConferenciasPorStatus(
  status: StatusConferencia,
): Promise<ConferenciaComContagem[]> {
  const db = await obterDatabase();

  const resultados = await db.getAllAsync<
    ConferenciaSQLite & { produtos_lidos: number }
  >(
    `
      SELECT
        conferencias.*,
        COUNT(leituras_conferencia.id) AS produtos_lidos
      FROM conferencias
      LEFT JOIN leituras_conferencia
        ON leituras_conferencia.conferencia_id = conferencias.id
      WHERE conferencias.status = ?
      GROUP BY conferencias.id
      ORDER BY conferencias.data_inicio DESC;
    `,
    status,
  );

  return resultados.map((item) => ({
    ...converterConferencia(item),
    produtosLidos: item.produtos_lidos,
  }));
}

// ============================================================
// FINALIZAR CONFERÊNCIA
// ============================================================

export async function finalizarConferencia(
  conferenciaId: number,
): Promise<void> {
  const db = await obterDatabase();

  const agora = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE conferencias
      SET
        data_fim = ?,
        status = 'finalizada'
      WHERE id = ?;
    `,
    agora,
    conferenciaId,
  );
}

// ============================================================
// REGISTRAR LEITURA DE CONFERÊNCIA
// ============================================================

export async function registrarLeituraConferencia(
  conferenciaId: number,
  codigoInterno: string,
  quantidade: number,
  primeiraLeitura: string,
  ultimaLeitura: string,
  statusInicial: StatusLeitura,
): Promise<void> {
  const db = await obterDatabase();

  const existente = await db.getFirstAsync<{
    id: number;
    quantidade: number;
  }>(
    `
      SELECT
        id,
        quantidade
      FROM leituras_conferencia
      WHERE conferencia_id = ?
        AND codigo_interno = ?
      LIMIT 1;
    `,
    conferenciaId,
    codigoInterno,
  );

  if (existente) {
    await db.runAsync(
      `
        UPDATE leituras_conferencia
        SET
          quantidade = ?,
          ultima_leitura = ?
        WHERE id = ?;
      `,
      existente.quantidade + quantidade,
      ultimaLeitura,
      existente.id,
    );

    return;
  }

  await db.runAsync(
    `
      INSERT INTO leituras_conferencia (
        conferencia_id,
        codigo_interno,
        quantidade,
        primeira_leitura,
        ultima_leitura,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    conferenciaId,
    codigoInterno,
    quantidade,
    primeiraLeitura,
    ultimaLeitura,
    statusInicial,
  );
}

// ============================================================
// ATUALIZAR STATUS DE UMA LEITURA
// ============================================================

export async function atualizarStatusLeitura(
  conferenciaId: number,
  codigoInterno: string,
  status: StatusLeitura,
): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      UPDATE leituras_conferencia
      SET status = ?
      WHERE conferencia_id = ?
        AND codigo_interno = ?;
    `,
    status,
    conferenciaId,
    codigoInterno,
  );
}

// ============================================================
// EDITAR QUANTIDADE DE UMA LEITURA
// ============================================================

export async function editarQuantidadeLeitura(
  conferenciaId: number,
  codigoInterno: string,
  novaQuantidade: number,
): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      UPDATE leituras_conferencia
      SET
        quantidade = ?,
        ultima_leitura = ?
      WHERE conferencia_id = ?
        AND codigo_interno = ?;
    `,
    novaQuantidade,
    new Date().toISOString(),
    conferenciaId,
    codigoInterno,
  );
}

// ============================================================
// REMOVER UMA LEITURA DA CONFERÊNCIA
// ============================================================

export async function removerLeituraConferencia(
  conferenciaId: number,
  codigoInterno: string,
): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      DELETE FROM leituras_conferencia
      WHERE conferencia_id = ?
        AND codigo_interno = ?;
    `,
    conferenciaId,
    codigoInterno,
  );
}

// ============================================================
// OBTER LEITURAS DE UMA CONFERÊNCIA
// ============================================================

type LeituraConferenciaSQLite = {
  id: number;
  quantidade: number;
  primeira_leitura: string;
  ultima_leitura: string;
  status: StatusLeitura;
  status_revisao: StatusRevisao;
  codigo_interno: string;
  codigo_barras: string | null;
  codigo_par: string | null;
  nome: string;
  marca: string | null;
  categoria: string | null;
  modelo: string | null;
  descricao: string | null;
  ativo: number;
  origem: string;
  tipo_produto: string;
};

export async function obterLeiturasConferencia(
  conferenciaId: number,
): Promise<LeituraConferencia[]> {
  const db = await obterDatabase();

  const resultados = await db.getAllAsync<LeituraConferenciaSQLite>(
    `
      SELECT
        leituras_conferencia.id AS id,
        leituras_conferencia.quantidade AS quantidade,
        leituras_conferencia.primeira_leitura AS primeira_leitura,
        leituras_conferencia.ultima_leitura AS ultima_leitura,
        leituras_conferencia.status AS status,
        leituras_conferencia.status_revisao AS status_revisao,
        produtos.codigo_interno AS codigo_interno,
        produtos.codigo_barras AS codigo_barras,
        produtos.codigo_par AS codigo_par,
        produtos.nome AS nome,
        produtos.marca AS marca,
        produtos.categoria AS categoria,
        produtos.modelo AS modelo,
        produtos.descricao AS descricao,
        produtos.ativo AS ativo,
        produtos.origem AS origem,
        produtos.tipo_produto AS tipo_produto
      FROM leituras_conferencia
      INNER JOIN produtos
        ON produtos.codigo_interno = leituras_conferencia.codigo_interno
      WHERE leituras_conferencia.conferencia_id = ?
      ORDER BY produtos.codigo_interno ASC;
    `,
    conferenciaId,
  );

  return resultados.map((item) => ({
    id: item.id,
    produto: converterProduto({
      codigo_interno: item.codigo_interno,
      codigo_barras: item.codigo_barras,
      codigo_par: item.codigo_par,
      nome: item.nome,
      marca: item.marca,
      categoria: item.categoria,
      modelo: item.modelo,
      descricao: item.descricao,
      ativo: item.ativo,
      origem: item.origem,
      es_ar_acondicionado: 0,
      tipo_produto: item.tipo_produto,
    }),
    quantidade: item.quantidade,
    primeiraLeitura: item.primeira_leitura,
    ultimaLeitura: item.ultima_leitura,
    status: item.status,
    statusRevisao: item.status_revisao,
  }));
}

// ============================================================
// OBTER RESUMO DE UMA CONFERÊNCIA
// ============================================================

export async function obterResumoConferencia(
  conferenciaId: number,
): Promise<ResumoConferencia> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<{
    produtos_lidos: number;
    unidades_lidas: number | null;
    nao_encontrados: number;
  }>(
    `
      SELECT
        COUNT(*) AS produtos_lidos,
        SUM(quantidade) AS unidades_lidas,
        SUM(CASE WHEN status = 'desconhecido' THEN 1 ELSE 0 END) AS nao_encontrados
      FROM leituras_conferencia
      WHERE conferencia_id = ?;
    `,
    conferenciaId,
  );

  return {
    produtosLidos: resultado?.produtos_lidos ?? 0,
    unidadesLidas: resultado?.unidades_lidas ?? 0,
    produtosNaoEncontrados: resultado?.nao_encontrados ?? 0,
  };
}

// ============================================================
// DADOS PARA EXPORTAR O HISTÓRICO
// ============================================================

export type DadosExportacaoConferencia = {
  conferencia: Conferencia;
  leituras: LeituraConferencia[];
};

export async function obterDadosExportacaoHistorico(): Promise<
  DadosExportacaoConferencia[]
> {
  const finalizadas = await listarConferenciasPorStatus('finalizada');

  const dados: DadosExportacaoConferencia[] = [];

  for (const conferencia of finalizadas) {
    const leituras = await obterLeiturasConferencia(conferencia.id);
    dados.push({ conferencia, leituras });
  }

  return dados;
}

// ============================================================
// APAGAR TODO O HISTÓRICO FINALIZADO
// Não afeta conferências em andamento nem o catálogo.
// ============================================================

export async function apagarHistoricoFinalizado(): Promise<number> {
  const db = await obterDatabase();

  let apagadas = 0;

  await db.withTransactionAsync(async () => {
    const finalizadas = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM conferencias WHERE status IN ('finalizada', 'cancelada');`,
    );

    for (const item of finalizadas) {
      await db.runAsync(
        `DELETE FROM leituras_conferencia WHERE conferencia_id = ?;`,
        item.id,
      );

      await db.runAsync(
        `DELETE FROM conferencias WHERE id = ?;`,
        item.id,
      );

      apagadas += 1;
    }
  });

  return apagadas;
}

// ============================================================
// LISTAR PRODUTOS MANUAIS / DESCONHECIDOS
// Usado na tela "Gerenciar produtos". Traz primeiro os
// desconhecidos (precisam de atenção), depois os manuais.
// ============================================================

export async function listarProdutosNaoCatalogo(): Promise<Produto[]> {
  const db = await obterDatabase();

  const resultados = await db.getAllAsync<ProdutoSQLite>(`
    SELECT *
    FROM produtos
    WHERE ativo = 1
      AND origem != 'catalogo'
    ORDER BY
      CASE origem WHEN 'desconhecido' THEN 0 ELSE 1 END,
      nome COLLATE NOCASE ASC;
  `);

  return resultados.map(converterProduto);
}

// ============================================================
// RESETAR BANCO DE DADOS
// Apaga TODAS as conferências (em andamento e finalizadas)
// e todos os produtos manuais/desconhecidos, depois reimporta
// o catálogo original do zero.
// NÃO apaga a tabela "configuracoes" — suas preferências
// (velocidade de leitura, etc.) permanecem.
// ============================================================

export async function resetarBancoDeDados(): Promise<void> {
  const db = await obterDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM leituras_conferencia;`);
    await db.runAsync(`DELETE FROM conferencias;`);
    await db.runAsync(`DELETE FROM produtos;`);
    await db.runAsync(`DELETE FROM configuracoes;`);
  });
}



// ============================================================
// ATUALIZAR NOME DE UMA CONFERÊNCIA
// Permite renomear uma conferência já criada, tanto da tela
// de leitura quanto da lista "Conferências em andamento".
// ============================================================

export async function atualizarNomeConferencia(
  conferenciaId: number,
  nome: string,
): Promise<void> {
  const db = await obterDatabase();

  const nomeLimpo = nome.trim() || null;

  await db.runAsync(
    `
      UPDATE conferencias
      SET nome = ?
      WHERE id = ?;
    `,
    nomeLimpo,
    conferenciaId,
  );
}

// ============================================================
// CANCELAR CONFERÊNCIA
// Marca a conferência como cancelada, preservando as leituras
// já registradas. Não pode ser continuada depois.
// ============================================================

export async function cancelarConferencia(
  conferenciaId: number,
): Promise<void> {
  const db = await obterDatabase();

  const agora = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE conferencias
      SET
        data_fim = ?,
        status = 'cancelada'
      WHERE id = ?;
    `,
    agora,
    conferenciaId,
  );
}

// ============================================================
// LISTAR HISTÓRICO (finalizadas + canceladas)
// Usado na tela de Histórico, que mostra ambas, diferenciadas
// visualmente.
// ============================================================

export async function listarHistorico(): Promise<
  ConferenciaComContagem[]
> {
  const db = await obterDatabase();

  const resultados = await db.getAllAsync<
    ConferenciaSQLite & { produtos_lidos: number }
  >(`
    SELECT
      conferencias.*,
      COUNT(leituras_conferencia.id) AS produtos_lidos
    FROM conferencias
    LEFT JOIN leituras_conferencia
      ON leituras_conferencia.conferencia_id = conferencias.id
    WHERE conferencias.status IN ('finalizada', 'cancelada')
    GROUP BY conferencias.id
    ORDER BY conferencias.data_inicio DESC;
  `);

  return resultados.map((item) => ({
    ...converterConferencia(item),
    produtosLidos: item.produtos_lidos,
  }));
}

// ============================================================
// MARCAR STATUS DE REVISÃO DE UM ITEM
// ============================================================

export async function marcarStatusRevisao(
  conferenciaId: number,
  codigoInterno: string,
  status: StatusRevisao,
): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      UPDATE leituras_conferencia
      SET status_revisao = ?
      WHERE conferencia_id = ? AND codigo_interno = ?;
    `,
    status,
    conferenciaId,
    codigoInterno,
  );
}

// ============================================================
// RESUMO DE REVISÃO DE UMA CONFERÊNCIA
// ============================================================

export async function obterResumoRevisao(
  conferenciaId: number,
): Promise<ResumoRevisao> {
  const db = await obterDatabase();

  const resultado = await db.getFirstAsync<{
    ok: number;
    divergencia: number;
    pendente: number;
    total: number;
  }>(
    `
      SELECT
        SUM(CASE WHEN status_revisao = 'ok' THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN status_revisao = 'divergencia' THEN 1 ELSE 0 END) AS divergencia,
        SUM(CASE WHEN status_revisao = 'pendente' THEN 1 ELSE 0 END) AS pendente,
        COUNT(*) AS total
      FROM leituras_conferencia
      WHERE conferencia_id = ?;
    `,
    conferenciaId,
  );

  return {
    ok: resultado?.ok ?? 0,
    divergencia: resultado?.divergencia ?? 0,
    pendente: resultado?.pendente ?? 0,
    total: resultado?.total ?? 0,
  };
}
