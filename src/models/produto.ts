// ============================================================
// MODELO DE PRODUTO — RAMSONS CONFERÊNCIA
// Parte 1/2
// ============================================================

// Origem de um produto no catálogo.
export type OrigemProduto = 'catalogo' | 'manual' | 'desconhecido';

// Producto que existe en la base de datos.
export type Produto = {
  codigoInterno: string;
  codigoBarras: string;
  nome: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  unidade?: string;
  estoque?: number;
  ativo: boolean;
  url?: string;
  especificacoes?: Record<string, string>;
  origem: OrigemProduto;
};

// ============================================================
// PRODUCTO LEÍDO DURANTE UNA CONFERENCIA
// ============================================================

export type ProdutoLido = {
  produto: Produto;
  quantidade: number;
  primeiraLeitura: string;
  ultimaLeitura: string;
};

// ============================================================
// TIPOS DE RESULTADO DE LECTURA
// Parte 2/2
// ============================================================

export type ResultadoLeitura = {
  codigoBarras: string;
  produto?: Produto;
  encontrado: boolean;
  mensagem: string;
  dataHora: string;
};

export type EstadoConferencia =
  | 'aguardando'
  | 'lendo'
  | 'produto-encontrado'
  | 'produto-nao-encontrado'
  | 'finalizada';

export type ResumoConferencia = {
  produtosLidos: number;
  unidadesLidas: number;
  produtosNaoEncontrados: number;
};

export type ProdutoImportacao = {
  codigoInterno: string;
  codigoBarras: string | null;
  nome: string;
  marca?: string | null;
  categoria?: string | null;
  modelo?: string | null;
  url?: string | null;
  especificacoes?: Record<string, string>;
  unidade?: string;
  estoque?: number;
  ativo?: boolean;
};

// ============================================================
// CONFERENCIA (SESIÓN)
// ============================================================

export type StatusConferencia = 'em_andamento' | 'finalizada' | 'cancelada';

export type Conferencia = {
  id: number;
  numero: string;
  nome: string;
  dataInicio: string;
  dataFim?: string;
  status: StatusConferencia;
};

// ============================================================
// ESTADO DE UNA LECTURA DENTRO DE LA LISTA
// ============================================================

export type StatusLeitura = 'normal' | 'novo' | 'desconhecido';

export type LeituraConferencia = {
  id: number;
  produto: Produto;
  quantidade: number;
  primeiraLeitura: string;
  ultimaLeitura: string;
  status: StatusLeitura;
};

export type DadosProdutoRapido = {
  nome: string;
  marca?: string;
  categoria?: string;
};
