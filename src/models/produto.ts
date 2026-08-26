// ============================================================
// MODELO DE PRODUTO — RAMSONS CONFERÊNCIA
// ============================================================

export type OrigemProduto = 'catalogo' | 'manual' | 'desconhecido';

export type TipoProduto = 'normal' | 'evaporadora' | 'condensadora';

export type Produto = {
  codigoInterno: string;
  codigoBarras: string;
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
  especificacoes_resumo?: string; // computed from fields above
  link?: string;
  ativo: boolean;
  origem: OrigemProduto;
  tipoProduto: TipoProduto;
};

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
  especificacoes_resumo?: string | null;
  tipoProduto?: string | null;
  codigoPar?: string | null;
};

// ============================================================
// CONFERENCIA (SESSÃO)
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
// ESTADO DE UMA LEITURA DENTRO DA LISTA
// ============================================================

export type StatusLeitura = 'normal' | 'novo' | 'desconhecido';

export type StatusRevisao = 'pendente' | 'ok' | 'divergencia';

export type LeituraConferencia = {
  id: number;
  produto: Produto;
  quantidade: number;
  primeiraLeitura: string;
  ultimaLeitura: string;
  status: StatusLeitura;
  statusRevisao: StatusRevisao;
};

export type ResumoRevisao = {
  ok: number;
  divergencia: number;
  pendente: number;
  total: number;
};

// ============================================================
// DADOS PARA COMPLETAR / REGISTRAR PRODUTO RÁPIDO
// Usado em leitura.tsx (modal de desconhecido) e
// completarProdutoDesconhecido().
// ============================================================

export type NfItem = {
  codigoInterno: string;
  quantidadeEsperada: number;
};

export type DadosProdutoRapido = {
  codigoInterno?: string;
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
  especificacoes_resumo?: string;
  link?: string;
  tipoProduto?: TipoProduto;
  codigoPar?: string;
};
