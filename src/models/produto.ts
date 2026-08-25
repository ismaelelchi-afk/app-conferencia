// ============================================================
// MODELO DE PRODUTO — RAMSONS CONFERÊNCIA
// ============================================================

export type OrigemProduto = 'catalogo' | 'manual' | 'desconhecido';

export type Produto = {
  codigoInterno: string;
  codigoBarras: string;
  codigoBarrasCond?: string;
  nome: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  descricao?: string;
  ativo: boolean;
  origem: OrigemProduto;
  esArAcondicionado: boolean;
};

export type ResumoConferencia = {
  produtosLidos: number;
  unidadesLidas: number;
  produtosNaoEncontrados: number;
};

// ============================================================
// IMPORTAÇÃO DE PRODUTOS (JSON externo)
// Estrutura aceita por importarCatalogoExterno.
// ============================================================

export type ProdutoImportacao = {
  codigoInterno: string;
  codigoBarras: string | null;
  nome: string;
  marca?: string | null;
  categoria?: string | null;
  modelo?: string | null;
  descricao?: string | null;
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
  vapLida: boolean;
  condLida: boolean;
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

export type DadosProdutoRapido = {
  codigoInterno?: string;
  nome: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  descricao?: string;
};
