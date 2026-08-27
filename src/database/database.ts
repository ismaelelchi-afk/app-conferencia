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
  NfItem,
  Produto,
  ProdutoImportacao,
  ResultadoBuscaIdentificador,
  ResumoConferencia,
  ResumoRevisao,
  StatusConferencia,
  StatusLeitura,
  StatusRevisao,
  TipoProduto,
} from '@/models/produto';

// Nombre del archivo de base de datos local.
const DATABASE_NAME = 'ramsons_conferencia.db';

// Conexión reutilizable.
let database: SQLite.SQLiteDatabase | null = null;
// Promise cache — evita que dos llamadas simultáneas abran dos conexiones.
let abrindoPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// ============================================================
// OBTENER CONEXIÓN
// ============================================================

async function obterDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  if (!abrindoPromise) {
    abrindoPromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then((db) => {
        database = db;
        abrindoPromise = null;
        return db;
      })
      .catch((err) => {
        abrindoPromise = null;
        throw err;
      });
  }

  return abrindoPromise;
}

// ============================================================
// FORMATAR NÚMERO DE CONFERENCIA
// ============================================================

export function formatarNumeroConferencia(id: number): string {
  return `#${String(id).padStart(6, '0')}`;
}

// Exibe códigos numéricos com 8 dígitos; códigos alfanuméricos inalterados.
export function formatarCodigoInterno(codigo: string): string {
  return /^\d+$/.test(codigo) ? codigo.padStart(8, '0') : codigo;
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

  // WAL mode: serializa escritas, permite lecturas concurrentes sin bloqueo.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA synchronous = NORMAL;');

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
      ativo INTEGER NOT NULL DEFAULT 1,
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

  // Tabela nf_itens — itens esperados da nota fiscal por conferência.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS nf_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conferencia_id INTEGER NOT NULL,
      codigo_interno TEXT NOT NULL,
      quantidade_esperada INTEGER NOT NULL,
      FOREIGN KEY (conferencia_id) REFERENCES conferencias(id)
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_nf_itens_conferencia
    ON nf_itens(conferencia_id, codigo_interno);
  `);

  // Migração: adiciona especificacoes_resumo se ainda não existir.
  const colEspecResumo = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = 'especificacoes_resumo';`,
  );
  if (!colEspecResumo || colEspecResumo.cnt === 0) {
    await db.execAsync(`ALTER TABLE produtos ADD COLUMN especificacoes_resumo TEXT;`);
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
    await db.execAsync(`ALTER TABLE produtos ADD COLUMN codigo_par TEXT;`);
  }

  // Migração: campos individuais de especificação.
  async function adicionarColunaSe(coluna: string, tipo = 'TEXT'): Promise<void> {
    const r = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM pragma_table_info('produtos') WHERE name = '${coluna}';`,
    );
    if (!r || r.cnt === 0) {
      await db.execAsync(`ALTER TABLE produtos ADD COLUMN ${coluna} ${tipo};`);
    }
  }
  await adicionarColunaSe('modelo');
  await adicionarColunaSe('subcategoria');
  await adicionarColunaSe('capacidad');
  await adicionarColunaSe('tecnologia');
  await adicionarColunaSe('ciclo');
  await adicionarColunaSe('voltaje');
  await adicionarColunaSe('color');
  await adicionarColunaSe('peso');
  await adicionarColunaSe('dimensiones');
  await adicionarColunaSe('link');
  await adicionarColunaSe('modelo_evaporadora');
  await adicionarColunaSe('modelo_condensadora');

  // Índices para busca por identificador (modelo, barras_cond).
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_produtos_modelo
      ON produtos (modelo) WHERE modelo IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_produtos_modelo_eva
      ON produtos (modelo_evaporadora) WHERE modelo_evaporadora IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_produtos_modelo_cond
      ON produtos (modelo_condensadora) WHERE modelo_condensadora IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_produtos_barras_cond
      ON produtos (codigo_barras_cond) WHERE codigo_barras_cond IS NOT NULL;
  `);

  // ----------------------------------------------------------
  // CONFIGURAÇÕES (chave/valor)
  // ----------------------------------------------------------

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL
    );
  `);

  // Migração única: limpa catálogo JSON embutido (removido na v2).
  // Executa apenas uma vez; após isso a flag 'catalogo_limpo_v2' impede repetição.
  const migV3 = await db.getFirstAsync<{ valor: string }>(
    `SELECT valor FROM configuracoes WHERE chave = 'catalogo_limpo_v3' LIMIT 1;`,
  );
  if (!migV3) {
    await db.runAsync(`DELETE FROM produtos;`);
    await db.runAsync(
      `INSERT INTO configuracoes (chave, valor) VALUES ('catalogo_limpo_v3', '1')
       ON CONFLICT(chave) DO UPDATE SET valor = '1';`,
    );
  }
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
  codigo_barras_cond: string | null;
  codigo_par: string | null;
  nome: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  modelo: string | null;
  modelo_evaporadora: string | null;
  modelo_condensadora: string | null;
  capacidad: string | null;
  tecnologia: string | null;
  ciclo: string | null;
  voltaje: string | null;
  color: string | null;
  peso: string | null;
  dimensiones: string | null;
  especificacoes_resumo: string | null;
  link: string | null;
  ativo: number;
  origem: string;
  es_ar_acondicionado: number;
  tipo_produto: string;
};

function converterProduto(produto: ProdutoSQLite): Produto {
  const partes = [
    produto.modelo,
    produto.subcategoria,
    produto.capacidad,
    produto.tecnologia,
    produto.ciclo,
    produto.voltaje,
    produto.color,
    produto.peso,
    produto.dimensiones,
  ].filter(Boolean) as string[];

  const especificacoes_resumo =
    partes.length > 0
      ? partes.join(' | ')
      : produto.especificacoes_resumo ?? undefined;

  return {
    codigoInterno: produto.codigo_interno,
    codigoBarras: produto.codigo_barras ?? '',
    codigoBarrasCond: produto.codigo_barras_cond ?? undefined,
    codigoPar: produto.codigo_par ?? undefined,
    nome: produto.nome,
    marca: produto.marca ?? undefined,
    categoria: produto.categoria ?? undefined,
    subcategoria: produto.subcategoria ?? undefined,
    modelo: produto.modelo ?? undefined,
    modeloEvaporadora: produto.modelo_evaporadora ?? undefined,
    modeloCondensadora: produto.modelo_condensadora ?? undefined,
    capacidad: produto.capacidad ?? undefined,
    tecnologia: produto.tecnologia ?? undefined,
    ciclo: produto.ciclo ?? undefined,
    voltaje: produto.voltaje ?? undefined,
    color: produto.color ?? undefined,
    peso: produto.peso ?? undefined,
    dimensiones: produto.dimensiones ?? undefined,
    especificacoes_resumo,
    link: produto.link ?? undefined,
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
        subcategoria,
        modelo,
        capacidad,
        tecnologia,
        ciclo,
        voltaje,
        color,
        peso,
        dimensiones,
        especificacoes_resumo,
        link,
        ativo,
        origem,
        tipo_produto,
        codigo_par
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    produto.codigoInterno,
    produto.codigoBarras || null,
    produto.nome,
    produto.marca ?? null,
    produto.categoria ?? null,
    produto.subcategoria ?? null,
    produto.modelo ?? null,
    produto.capacidad ?? null,
    produto.tecnologia ?? null,
    produto.ciclo ?? null,
    produto.voltaje ?? null,
    produto.color ?? null,
    produto.peso ?? null,
    produto.dimensiones ?? null,
    produto.especificacoes_resumo ?? null,
    produto.link ?? null,
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
// BUSCAR POR IDENTIFICADOR — modelo, barras_cond ou barras
// Busca em todas as colunas de identificação, na ordem definida.
// Retorna 'encontrado' (produto único), 'multiplos' (ambiguidade)
// ou undefined (não encontrado).
// ============================================================

const COLUNAS_BUSCA: Array<{ coluna: string; via: string }> = [
  { coluna: 'codigo_barras',      via: 'codigo_barras'      },
  { coluna: 'codigo_barras_cond', via: 'codigo_barras_cond' },
  { coluna: 'modelo',             via: 'modelo'             },
  { coluna: 'modelo_evaporadora', via: 'modelo_evaporadora' },
  { coluna: 'modelo_condensadora', via: 'modelo_condensadora' },
];

export async function buscarPorIdentificador(
  valor: string,
): Promise<ResultadoBuscaIdentificador | undefined> {
  const v = valor.trim();
  if (!v) return undefined;

  const db = await obterDatabase();

  for (const { coluna, via } of COLUNAS_BUSCA) {
    const resultados = await db.getAllAsync<ProdutoSQLite>(
      `SELECT * FROM produtos WHERE ${coluna} = ? AND ativo = 1 LIMIT 2;`,
      v,
    );
    if (resultados.length === 1) {
      return { tipo: 'encontrado', produto: converterProduto(resultados[0]), via };
    }
    if (resultados.length > 1) {
      return { tipo: 'multiplos', produtos: resultados.map(converterProduto) };
    }
  }

  return undefined;
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
           subcategoria = ?,
           modelo = ?,
           capacidad = ?,
           tecnologia = ?,
           ciclo = ?,
           voltaje = ?,
           color = ?,
           peso = ?,
           dimensiones = ?,
           link = ?,
           especificacoes_resumo = NULL,
           tipo_produto = ?,
           codigo_par = ?
         WHERE codigo_interno = ?;`,
        produto.codigoInterno,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.subcategoria ?? null,
        produto.modelo ?? null,
        produto.capacidad ?? null,
        produto.tecnologia ?? null,
        produto.ciclo ?? null,
        produto.voltaje ?? null,
        produto.color ?? null,
        produto.peso ?? null,
        produto.dimensiones ?? null,
        produto.link ?? null,
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
// IMPORTAR CATÁLOGO DE EXCEL (.xlsx)
// Espera planilha com colunas "codigo de barras" e "nome"
// (case-insensitive, qualquer ordem).
// ============================================================

export async function importarCatalogoExcel(base64: string): Promise<number> {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Arquivo Excel vazio.');

  const sheet = workbook.Sheets[sheetName];
  // raw: false preserva strings formatadas (zeros iniciais, alfanuméricos, guiones).
  const linhas = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });

  if (linhas.length < 2) throw new Error('Planilha sem dados.');

  const cabecalho = linhas[0].map((c) =>
    String(c ?? '').toLowerCase().trim(),
  );

  // Exclusão de colunas já atribuídas para evitar conflito entre
  // "Código de barras" e "Código de barras 2".
  const encontrados = new Set<number>();

  function acharColuna(...termos: string[]): number {
    // Exact match first
    for (const t of termos) {
      const idx = cabecalho.findIndex((h, i) => !encontrados.has(i) && h === t);
      if (idx >= 0) { encontrados.add(idx); return idx; }
    }
    // Substring fallback
    for (const t of termos) {
      const idx = cabecalho.findIndex((h, i) => !encontrados.has(i) && h.includes(t));
      if (idx >= 0) { encontrados.add(idx); return idx; }
    }
    return -1;
  }

  // Detectar columnas específicas ANTES que las genéricas para evitar ambigüedad.
  const colBarrasCond   = acharColuna(
    'código de barras condensadora', 'codigo de barras condensadora',
    'barras condensadora', 'barras_cond', 'ean condensadora',
    'código de barras 2', 'codigo de barras 2', 'barras 2', 'barcode 2', 'ean2', 'ean 2',
  );
  const colBarras       = acharColuna('código de barras', 'codigo de barras', 'barcode', 'ean', 'barras');
  const colInterno      = acharColuna('código interno', 'codigo interno', 'codigo_interno', 'interno');
  const colNome         = acharColuna('nombre del producto', 'nombre', 'nome', 'name', 'produto');
  const colMarca        = acharColuna('marca', 'brand');
  const colCateg        = acharColuna('categoría', 'categoria', 'category');
  const colSubCateg     = acharColuna('subcategoría', 'subcategoria', 'subcategory', 'subcateg');
  const colTipo         = acharColuna('tipo de producto', 'tipo', 'type');
  const colModeloEva    = acharColuna('modelo evaporadora', 'modelo_evaporadora', 'model evaporadora', 'modelo eva');
  const colModeloCond   = acharColuna('modelo condensadora', 'modelo_condensadora', 'model condensadora', 'modelo cond');
  const colModelo       = acharColuna('modelo', 'model');
  const colCapacid      = acharColuna('capacidad', 'capacidade', 'capacity', 'btu');
  const colTecnolog     = acharColuna('tecnología', 'tecnologia', 'technology');
  const colCiclo        = acharColuna('ciclo', 'cycle');
  const colVoltaje      = acharColuna('voltaje', 'voltagem', 'voltage', 'volt');
  const colColor        = acharColuna('color', 'cor', 'colour');
  const colPeso         = acharColuna('peso', 'weight');
  const colDimensi      = acharColuna('dimensiones', 'dimensões', 'dimensoes', 'dimensions');
  const colPar          = acharColuna('código del conjunto', 'codigo del conjunto', 'conjunto', 'codigo_par', 'par');
  const colLink         = acharColuna('link', 'url', 'enlace');

  if (colBarras < 0) throw new Error('Coluna "Código de barras" não encontrada.');
  if (colNome < 0)   throw new Error('Coluna "Nombre del producto" não encontrada.');

  function cel(linha: string[], col: number): string {
    return col >= 0 ? String(linha[col] ?? '').trim() : '';
  }

  type LinhaImport = {
    codigoInterno: string;
    codigoBarras: string;
    codigoBarrasCond: string | null;
    nome: string;
    marca: string | null;
    categoria: string | null;
    subcategoria: string | null;
    modelo: string | null;
    modeloEvaporadora: string | null;
    modeloCondensadora: string | null;
    capacidad: string | null;
    tecnologia: string | null;
    ciclo: string | null;
    voltaje: string | null;
    color: string | null;
    peso: string | null;
    dimensiones: string | null;
    link: string | null;
    tipoProduto: string;
    codigoPar: string | null;
  };

  const produtos: LinhaImport[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const barras = cel(linha, colBarras);
    const nome   = cel(linha, colNome);
    if (!barras || !nome) continue;

    const interno   = cel(linha, colInterno);
    const marca     = cel(linha, colMarca);
    const categ     = cel(linha, colCateg);
    const tipoRaw   = cel(linha, colTipo).toLowerCase();
    const par       = cel(linha, colPar);

    const tipoProduto =
      tipoRaw === 'evaporadora' ? 'evaporadora'
      : tipoRaw === 'condensadora' ? 'condensadora'
      : 'normal';

    produtos.push({
      codigoInterno: interno || barras,
      codigoBarras: barras,
      codigoBarrasCond: cel(linha, colBarrasCond) || null,
      nome,
      marca: marca || null,
      categoria: categ || null,
      subcategoria: cel(linha, colSubCateg) || null,
      modelo: cel(linha, colModelo) || null,
      modeloEvaporadora: cel(linha, colModeloEva) || null,
      modeloCondensadora: cel(linha, colModeloCond) || null,
      capacidad: cel(linha, colCapacid) || null,
      tecnologia: cel(linha, colTecnolog) || null,
      ciclo: cel(linha, colCiclo) || null,
      voltaje: cel(linha, colVoltaje) || null,
      color: cel(linha, colColor) || null,
      peso: cel(linha, colPeso) || null,
      dimensiones: cel(linha, colDimensi) || null,
      link: cel(linha, colLink) || null,
      tipoProduto,
      codigoPar: par || null,
    });
  }

  if (produtos.length === 0) throw new Error('Nenhum produto válido encontrado.');

  const db = await obterDatabase();

  await db.withTransactionAsync(async () => {
    for (const p of produtos) {
      // Atualiza produto existente pelo código de barras
      const upd = await db.runAsync(
        `UPDATE produtos
         SET nome = ?, marca = ?, categoria = ?, subcategoria = ?,
             modelo = ?, modelo_evaporadora = ?, modelo_condensadora = ?,
             codigo_barras_cond = ?,
             capacidad = ?, tecnologia = ?, ciclo = ?, voltaje = ?, color = ?,
             peso = ?, dimensiones = ?, link = ?, tipo_produto = ?, codigo_par = ?,
             especificacoes_resumo = NULL, origem = 'catalogo', ativo = 1
         WHERE codigo_barras = ?;`,
        p.nome, p.marca, p.categoria, p.subcategoria,
        p.modelo, p.modeloEvaporadora, p.modeloCondensadora,
        p.codigoBarrasCond,
        p.capacidad, p.tecnologia, p.ciclo, p.voltaje, p.color,
        p.peso, p.dimensiones, p.link, p.tipoProduto, p.codigoPar,
        p.codigoBarras,
      );

      if (upd.changes === 0) {
        await db.runAsync(
          `INSERT OR IGNORE INTO produtos
             (codigo_interno, codigo_barras, codigo_barras_cond,
              nome, marca, categoria, subcategoria,
              modelo, modelo_evaporadora, modelo_condensadora,
              capacidad, tecnologia, ciclo, voltaje, color, peso, dimensiones,
              link, tipo_produto, codigo_par, origem)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'catalogo');`,
          p.codigoInterno, p.codigoBarras, p.codigoBarrasCond,
          p.nome, p.marca, p.categoria, p.subcategoria,
          p.modelo, p.modeloEvaporadora, p.modeloCondensadora,
          p.capacidad, p.tecnologia, p.ciclo, p.voltaje, p.color,
          p.peso, p.dimensiones, p.link, p.tipoProduto, p.codigoPar,
        );
      }
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
    subcategoria: string | null;
    modelo: string | null;
    capacidad: string | null;
    tecnologia: string | null;
    ciclo: string | null;
    voltaje: string | null;
    color: string | null;
    peso: string | null;
    dimensiones: string | null;
    link: string | null;
    tipo_produto: string;
    codigo_par: string | null;
    origem: string;
  }>(`
    SELECT codigo_interno, codigo_barras, nome, marca, categoria,
           subcategoria, modelo, capacidad, tecnologia, ciclo, voltaje, color, peso, dimensiones,
           link, tipo_produto, codigo_par, origem
    FROM produtos
    WHERE ativo = 1
    ORDER BY nome COLLATE NOCASE ASC;
  `);

  const dados = rows.map((r) => ({
    'Código de barras': r.codigo_barras ?? '',
    'Código interno': r.codigo_interno,
    'Modelo': r.modelo ?? '',
    'Nombre del producto': r.nome,
    'Marca': r.marca ?? '',
    'Categoría': r.categoria ?? '',
    'Subcategoría': r.subcategoria ?? '',
    'Tipo de producto': r.tipo_produto,
    'Capacidad': r.capacidad ?? '',
    'Tecnología': r.tecnologia ?? '',
    'Ciclo': r.ciclo ?? '',
    'Voltaje': r.voltaje ?? '',
    'Color': r.color ?? '',
    'Peso': r.peso ?? '',
    'Dimensiones': r.dimensiones ?? '',
    'Link': r.link ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

  worksheet['!cols'] = [
    { wch: 18 }, // Código de barras
    { wch: 16 }, // Código interno
    { wch: 16 }, // Modelo
    { wch: 42 }, // Nombre del producto
    { wch: 18 }, // Marca
    { wch: 18 }, // Categoría
    { wch: 16 }, // Subcategoría
    { wch: 14 }, // Tipo de producto
    { wch: 14 }, // Capacidad
    { wch: 14 }, // Tecnología
    { wch: 10 }, // Ciclo
    { wch: 10 }, // Voltaje
    { wch: 12 }, // Color
    { wch: 10 }, // Peso
    { wch: 20 }, // Dimensiones
    { wch: 40 }, // Link
  ];

  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
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
  subcategoria?: string;
  modelo?: string;
  capacidad?: string;
  tecnologia?: string;
  ciclo?: string;
  voltaje?: string;
  color?: string;
  peso?: string;
  dimensiones?: string;
  link?: string;
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
    subcategoria: dados.subcategoria,
    modelo: dados.modelo,
    capacidad: dados.capacidad,
    tecnologia: dados.tecnologia,
    ciclo: dados.ciclo,
    voltaje: dados.voltaje,
    color: dados.color,
    peso: dados.peso,
    dimensiones: dados.dimensiones,
    link: dados.link,
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

    // Atualiza status de 'desconhecido' para 'novo' em todas as conferências
    await db.runAsync(
      `UPDATE leituras_conferencia
       SET status = 'novo'
       WHERE codigo_interno = ? AND status = 'desconhecido';`,
      novoCodigoInterno,
    );

    const temCamposIndividuais = !!(
      dados.modelo || dados.subcategoria || dados.capacidad ||
      dados.tecnologia || dados.ciclo || dados.voltaje ||
      dados.color || dados.peso || dados.dimensiones
    );

    await db.runAsync(
      `UPDATE produtos
       SET
         codigo_interno = ?,
         nome = ?,
         marca = ?,
         categoria = ?,
         subcategoria = ?,
         modelo = ?,
         capacidad = ?,
         tecnologia = ?,
         ciclo = ?,
         voltaje = ?,
         color = ?,
         peso = ?,
         dimensiones = ?,
         link = ?,
         especificacoes_resumo = ?,
         tipo_produto = ?,
         codigo_par = ?,
         origem = 'manual'
       WHERE codigo_interno = ?;`,
      novoCodigoInterno,
      dados.nome,
      dados.marca ?? null,
      dados.categoria ?? null,
      dados.subcategoria ?? null,
      dados.modelo ?? null,
      dados.capacidad ?? null,
      dados.tecnologia ?? null,
      dados.ciclo ?? null,
      dados.voltaje ?? null,
      dados.color ?? null,
      dados.peso ?? null,
      dados.dimensiones ?? null,
      dados.link ?? null,
      temCamposIndividuais ? null : (dados.especificacoes_resumo ?? null),
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
        status,
        status_revisao
      )
      VALUES (?, ?, ?, ?, ?, ?, 'ok');
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
  codigo_barras_cond: string | null;
  codigo_par: string | null;
  nome: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  modelo: string | null;
  modelo_evaporadora: string | null;
  modelo_condensadora: string | null;
  capacidad: string | null;
  tecnologia: string | null;
  ciclo: string | null;
  voltaje: string | null;
  color: string | null;
  peso: string | null;
  dimensiones: string | null;
  especificacoes_resumo: string | null;
  link: string | null;
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
        produtos.codigo_barras_cond AS codigo_barras_cond,
        produtos.codigo_par AS codigo_par,
        produtos.nome AS nome,
        produtos.marca AS marca,
        produtos.categoria AS categoria,
        produtos.subcategoria AS subcategoria,
        produtos.modelo AS modelo,
        produtos.modelo_evaporadora AS modelo_evaporadora,
        produtos.modelo_condensadora AS modelo_condensadora,
        produtos.capacidad AS capacidad,
        produtos.tecnologia AS tecnologia,
        produtos.ciclo AS ciclo,
        produtos.voltaje AS voltaje,
        produtos.color AS color,
        produtos.peso AS peso,
        produtos.dimensiones AS dimensiones,
        produtos.especificacoes_resumo AS especificacoes_resumo,
        produtos.link AS link,
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
      codigo_barras_cond: item.codigo_barras_cond,
      codigo_par: item.codigo_par,
      nome: item.nome,
      marca: item.marca,
      categoria: item.categoria,
      subcategoria: item.subcategoria,
      modelo: item.modelo,
      modelo_evaporadora: item.modelo_evaporadora,
      modelo_condensadora: item.modelo_condensadora,
      capacidad: item.capacidad,
      tecnologia: item.tecnologia,
      ciclo: item.ciclo,
      voltaje: item.voltaje,
      color: item.color,
      peso: item.peso,
      dimensiones: item.dimensiones,
      especificacoes_resumo: item.especificacoes_resumo,
      link: item.link,
      ativo: item.ativo,
      origem: item.origem,
      es_ar_acondicionado: 0,
      tipo_produto: item.tipo_produto,
    }),
    quantidade: item.quantidade,
    primeiraLeitura: item.primeira_leitura,
    ultimaLeitura: item.ultima_leitura,
    status: item.status === 'desconhecido' && item.origem !== 'desconhecido'
      ? 'novo'
      : item.status,
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
// EXPORTAR HISTÓRICO DE CONFERÊNCIAS PARA EXCEL
// Uma aba por conferência, linhas = produtos lidos.
// ============================================================

export async function exportarHistoricoExcel(): Promise<string> {
  const dados = await obterDadosExportacaoHistorico();

  if (dados.length === 0) {
    throw new Error('Não há conferências finalizadas para exportar.');
  }

  const workbook = XLSX.utils.book_new();

  for (const { conferencia, leituras } of dados) {
    const nomePlanilha = conferencia.nome.slice(0, 31).replace(/[\\/*?[\]:]/g, '-');

    const linhas = leituras.map((l) => ({
      'Código Interno': l.produto.codigoInterno,
      'Código de Barras': l.produto.codigoBarras ?? '',
      'Nome': l.produto.nome,
      'Quantidade': l.quantidade,
      'Tipo': l.produto.tipoProduto,
      'Código do Conjunto': l.produto.codigoPar ?? '',
      'Status': l.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(linhas);
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 40 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, nomePlanilha);
  }

  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
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

// ============================================================
// NF_ITENS — ITENS ESPERADOS DA NOTA FISCAL
// ============================================================

type ResultadoImportNf = {
  carregados: number;
  ignorados: number;
  codigosDesconhecidos: string[];
};

export async function importarNfItens(
  conferenciaId: number,
  base64: string,
): Promise<ResultadoImportNf> {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Arquivo Excel vazio.');

  const sheet = workbook.Sheets[sheetName];
  const linhas = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (linhas.length < 2) throw new Error('Planilha sem dados.');

  const cabecalho = linhas[0].map((c) => String(c ?? '').toLowerCase().trim().replace(/[\s.]+/g, '_'));

  const colCodigo = cabecalho.findIndex((h) =>
    [
      'codigo_interno', 'código_interno', 'codigo', 'código',
      'cod_interno', 'cod', 'referencia', 'referência', 'item',
      'codigo_barras', 'código_barras', 'cod_barras', 'barras',
      'ean', 'gtin', 'codprod', 'cod_prod',
    ].includes(h),
  );
  const colQtd = cabecalho.findIndex((h) =>
    [
      'quantidade', 'qtd', 'qty', 'quantity', 'cant', 'cantidad',
      'qtde', 'quant', 'qde', 'qt', 'qtdade', 'qtd_',
    ].includes(h),
  );

  if (colCodigo < 0) throw new Error(`Coluna de código não encontrada. Cabeçalhos detectados: ${cabecalho.join(', ')}`);
  if (colQtd < 0) throw new Error(`Coluna de quantidade não encontrada. Cabeçalhos detectados: ${cabecalho.join(', ')}`);

  // Agrupa quantidades por código bruto do Excel.
  const mapaQtdBruto = new Map<string, number>();
  let ignorados = 0;

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.length === 0) continue;

    const codigo = String(linha[colCodigo] ?? '').trim();
    const qtdRaw = Number(linha[colQtd]);

    if (!codigo) { ignorados++; continue; }
    if (!Number.isFinite(qtdRaw) || qtdRaw <= 0) { ignorados++; continue; }

    mapaQtdBruto.set(codigo, (mapaQtdBruto.get(codigo) ?? 0) + Math.floor(qtdRaw));
  }

  // Resolve cada código bruto para o codigo_interno do catálogo.
  // Tenta: (1) match exato por codigo_interno, (2) match numérico sem zeros, (3) match por codigo_barras.
  const db = await obterDatabase();
  const mapaQtd = new Map<string, number>(); // keyed by codigo_interno resolvido
  const codigosDesconhecidos: string[] = [];

  for (const [codigoBruto, qtd] of mapaQtdBruto.entries()) {
    // (1) match exato
    let produto = await db.getFirstAsync<{ codigo_interno: string }>(
      `SELECT codigo_interno FROM produtos WHERE codigo_interno = ? AND ativo = 1 LIMIT 1;`,
      codigoBruto,
    );

    // (2) match numérico normalizado — trata zeros à esquerda
    if (!produto && /^\d+$/.test(codigoBruto)) {
      const semZeros = String(Number(codigoBruto));
      produto = await db.getFirstAsync<{ codigo_interno: string }>(
        `SELECT codigo_interno FROM produtos WHERE codigo_interno = ? AND ativo = 1 LIMIT 1;`,
        semZeros,
      );
      if (!produto) {
        // tenta com zeros padded
        const comZeros = codigoBruto.padStart(8, '0');
        produto = await db.getFirstAsync<{ codigo_interno: string }>(
          `SELECT codigo_interno FROM produtos WHERE codigo_interno = ? AND ativo = 1 LIMIT 1;`,
          comZeros,
        );
      }
    }

    // (3) match por codigo_barras
    if (!produto) {
      produto = await db.getFirstAsync<{ codigo_interno: string }>(
        `SELECT codigo_interno FROM produtos WHERE codigo_barras = ? AND ativo = 1 LIMIT 1;`,
        codigoBruto,
      );
    }

    const codigoResolvido = produto?.codigo_interno ?? codigoBruto;
    if (!produto) codigosDesconhecidos.push(codigoBruto);

    mapaQtd.set(codigoResolvido, (mapaQtd.get(codigoResolvido) ?? 0) + qtd);
  }

  // Substitui itens anteriores desta conferência.
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM nf_itens WHERE conferencia_id = ?;`, conferenciaId);

    for (const [codigo, qtd] of mapaQtd.entries()) {
      await db.runAsync(
        `INSERT INTO nf_itens (conferencia_id, codigo_interno, quantidade_esperada) VALUES (?, ?, ?);`,
        conferenciaId,
        codigo,
        qtd,
      );
    }
  });

  return {
    carregados: mapaQtd.size,
    ignorados,
    codigosDesconhecidos,
  };
}

export async function obterNfItens(conferenciaId: number): Promise<NfItem[]> {
  const db = await obterDatabase();

  const rows = await db.getAllAsync<{ codigo_interno: string; quantidade_esperada: number }>(
    `SELECT codigo_interno, quantidade_esperada FROM nf_itens WHERE conferencia_id = ? ORDER BY codigo_interno;`,
    conferenciaId,
  );

  return rows.map((r) => ({
    codigoInterno: r.codigo_interno,
    quantidadeEsperada: r.quantidade_esperada,
  }));
}

export async function limparNfItens(conferenciaId: number): Promise<void> {
  const db = await obterDatabase();
  await db.runAsync(`DELETE FROM nf_itens WHERE conferencia_id = ?;`, conferenciaId);
}

export async function temNfCarregada(conferenciaId: number): Promise<boolean> {
  const db = await obterDatabase();
  const r = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM nf_itens WHERE conferencia_id = ? LIMIT 1;`,
    conferenciaId,
  );
  return (r?.cnt ?? 0) > 0;
}
