// ============================================================
// BASE DE DATOS SQLITE — RAMSONS CONFERÊNCIA
// Parte 1/2 — Esquema, produtos e catálogo
// ============================================================

import * as SQLite from 'expo-sqlite';

import type {
  Conferencia,
  DadosProdutoRapido,
  LeituraConferencia,
  Produto,
  ProdutoImportacao,
  ResumoConferencia,
  StatusConferencia,
  StatusLeitura,
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

function formatarNumeroConferencia(id: number): string {
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
  nome: string;
  marca: string | null;
  categoria: string | null;
  modelo: string | null;
  unidade: string | null;
  estoque: number | null;
  ativo: number;
  url: string | null;
  especificacoes: string | null;
  origem: string;
};

function converterProduto(produto: ProdutoSQLite): Produto {
  let especificacoes: Record<string, string> | undefined;

  if (produto.especificacoes) {
    try {
      especificacoes = JSON.parse(produto.especificacoes);
    } catch {
      especificacoes = undefined;
    }
  }

  return {
    codigoInterno: produto.codigo_interno,
    codigoBarras: produto.codigo_barras ?? '',
    nome: produto.nome,
    marca: produto.marca ?? undefined,
    categoria: produto.categoria ?? undefined,
    modelo: produto.modelo ?? undefined,
    unidade: produto.unidade ?? undefined,
    estoque: produto.estoque ?? 0,
    ativo: produto.ativo === 1,
    url: produto.url ?? undefined,
    especificacoes,
    origem: (produto.origem as Produto['origem']) ?? 'catalogo',
  };
}

// ============================================================
// ADICIONAR PRODUTO
// ============================================================

export async function adicionarProduto(produto: Produto): Promise<void> {
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
        unidade,
        estoque,
        ativo,
        url,
        especificacoes,
        origem
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    produto.codigoInterno,
    produto.codigoBarras || null,
    produto.nome,
    produto.marca ?? null,
    produto.categoria ?? null,
    produto.modelo ?? null,
    produto.unidade ?? null,
    produto.estoque ?? 0,
    produto.ativo ? 1 : 0,
    produto.url ?? null,
    produto.especificacoes ? JSON.stringify(produto.especificacoes) : null,
    produto.origem,
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

export async function atualizarProduto(produto: Produto): Promise<boolean> {
  const db = await obterDatabase();

  const resultado = await db.runAsync(
    `
      UPDATE produtos
      SET
        codigo_barras = ?,
        nome = ?,
        marca = ?,
        categoria = ?,
        modelo = ?,
        unidade = ?,
        estoque = ?,
        ativo = ?,
        url = ?,
        especificacoes = ?,
        origem = ?
      WHERE codigo_interno = ?;
    `,
    produto.codigoBarras || null,
    produto.nome,
    produto.marca ?? null,
    produto.categoria ?? null,
    produto.modelo ?? null,
    produto.unidade ?? null,
    produto.estoque ?? 0,
    produto.ativo ? 1 : 0,
    produto.url ?? null,
    produto.especificacoes ? JSON.stringify(produto.especificacoes) : null,
    produto.origem,
    produto.codigoInterno,
  );

  return resultado.changes > 0;
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
      SET ativo = 0
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
// INSERTAR PRODUCTOS DE PRUEBA
// Conservada para pruebas locais manuais.
// NO se ejecuta automáticamente al iniciar la app.
// ============================================================

export async function inserirProdutosTeste(): Promise<void> {
  const total = await contarProdutos();

  if (total > 0) {
    return;
  }

  const produtosTeste: Produto[] = [
    {
      codigoInterno: 'RAM-000001',
      codigoBarras: '7891234567890',
      nome: 'Produto de teste A',
      marca: 'RAMSONS',
      categoria: 'Teste',
      unidade: 'UN',
      estoque: 10,
      ativo: true,
      origem: 'catalogo',
    },
    {
      codigoInterno: 'RAM-000002',
      codigoBarras: '7891234567891',
      nome: 'Produto de teste B',
      marca: 'RAMSONS',
      categoria: 'Teste',
      unidade: 'UN',
      estoque: 20,
      ativo: true,
      origem: 'catalogo',
    },
  ];

  for (const produto of produtosTeste) {
    await adicionarProduto(produto);
  }
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
            unidade,
            estoque,
            ativo,
            url,
            especificacoes,
            origem
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'catalogo');
        `,
        produto.codigoInterno,
        produto.codigoBarras || null,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.unidade ?? 'UN',
        produto.estoque ?? 0,
        produto.ativo === false ? 0 : 1,
        produto.url ?? null,
        produto.especificacoes
          ? JSON.stringify(produto.especificacoes)
          : null,
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
            unidade,
            estoque,
            ativo,
            url,
            especificacoes,
            origem
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'catalogo');
        `,
        produto.codigoInterno,
        produto.codigoBarras || null,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.unidade ?? 'UN',
        produto.estoque ?? 0,
        produto.ativo === false ? 0 : 1,
        produto.url ?? null,
        produto.especificacoes
          ? JSON.stringify(produto.especificacoes)
          : null,
      );
    }
  });

  await salvarConfiguracao('catalogo_atualizado_em', new Date().toISOString());

  return lista.length;
}

// ============================================================
// CRIAR PRODUTO MANUAL (formulário "Cadastrar produto")
// ============================================================

export type DadosProdutoManual = {
  codigoBarras?: string | null;
  nome: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  unidade?: string;
  estoque?: number;
};

export async function criarProdutoManual(
  dados: DadosProdutoManual,
): Promise<Produto> {
  const codigoInterno = gerarCodigoInternoManual();

  const produto: Produto = {
    codigoInterno,
    codigoBarras: dados.codigoBarras ?? '',
    nome: dados.nome,
    marca: dados.marca,
    categoria: dados.categoria,
    modelo: dados.modelo,
    unidade: dados.unidade ?? 'UN',
    estoque: dados.estoque ?? 0,
    ativo: true,
    origem: 'manual',
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

  const codigoInterno = gerarCodigoInternoDesconhecido(codigoBarras);
  const unidadePadrao = await obterConfiguracao('unidade_padrao', 'UN');

  const produto: Produto = {
    codigoInterno,
    codigoBarras,
    nome: `Produto não identificado (${codigoBarras})`,
    unidade: unidadePadrao,
    estoque: 0,
    ativo: true,
    origem: 'desconhecido',
  };

  await adicionarProduto(produto);

  return produto;
}

// ============================================================
// COMPLETAR PRODUTO DESCONHECIDO
// ============================================================

export async function completarProdutoDesconhecido(
  codigoInterno: string,
  dados: DadosProdutoRapido,
): Promise<void> {
  const db = await obterDatabase();

  await db.runAsync(
    `
      UPDATE produtos
      SET
        nome = ?,
        marca = ?,
        categoria = ?,
        origem = 'manual'
      WHERE codigo_interno = ?;
    `,
    dados.nome,
    dados.marca ?? null,
    dados.categoria ?? null,
    codigoInterno,
  );
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
  codigo_interno: string;
  codigo_barras: string | null;
  nome: string;
  marca: string | null;
  categoria: string | null;
  modelo: string | null;
  unidade: string | null;
  estoque: number | null;
  ativo: number;
  url: string | null;
  especificacoes: string | null;
  origem: string;
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
        produtos.codigo_interno AS codigo_interno,
        produtos.codigo_barras AS codigo_barras,
        produtos.nome AS nome,
        produtos.marca AS marca,
        produtos.categoria AS categoria,
        produtos.modelo AS modelo,
        produtos.unidade AS unidade,
        produtos.estoque AS estoque,
        produtos.ativo AS ativo,
        produtos.url AS url,
        produtos.especificacoes AS especificacoes,
        produtos.origem AS origem
      FROM leituras_conferencia
      INNER JOIN produtos
        ON produtos.codigo_interno = leituras_conferencia.codigo_interno
      WHERE leituras_conferencia.conferencia_id = ?
      ORDER BY leituras_conferencia.ultima_leitura DESC;
    `,
    conferenciaId,
  );

  return resultados.map((item) => ({
    id: item.id,
    produto: converterProduto({
      codigo_interno: item.codigo_interno,
      codigo_barras: item.codigo_barras,
      nome: item.nome,
      marca: item.marca,
      categoria: item.categoria,
      modelo: item.modelo,
      unidade: item.unidade,
      estoque: item.estoque,
      ativo: item.ativo,
      url: item.url,
      especificacoes: item.especificacoes,
      origem: item.origem,
    }),
    quantidade: item.quantidade,
    primeiraLeitura: item.primeira_leitura,
    ultimaLeitura: item.ultima_leitura,
    status: item.status,
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
      `SELECT id FROM conferencias WHERE status = 'finalizada';`,
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

export async function resetarBancoDeDados(): Promise<number> {
  const db = await obterDatabase();

  const lista = produtosRamsons as ProdutoImportacao[];

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM leituras_conferencia;`);
    await db.runAsync(`DELETE FROM conferencias;`);
    await db.runAsync(`DELETE FROM produtos;`);

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
            unidade,
            estoque,
            ativo,
            url,
            especificacoes,
            origem
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'catalogo');
        `,
        produto.codigoInterno,
        produto.codigoBarras || null,
        produto.nome,
        produto.marca ?? null,
        produto.categoria ?? null,
        produto.modelo ?? null,
        produto.unidade ?? 'UN',
        produto.estoque ?? 0,
        produto.ativo === false ? 0 : 1,
        produto.url ?? null,
        produto.especificacoes
          ? JSON.stringify(produto.especificacoes)
          : null,
      );
    }
  });

  await salvarConfiguracao('catalogo_atualizado_em', new Date().toISOString());

  return lista.length;
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
