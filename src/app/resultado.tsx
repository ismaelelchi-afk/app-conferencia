// ============================================================
// RESULTADO — RAMSONS CONFERÊNCIA
// Parte 1/2 — Estado, carga de dados, lógica de edição
// ============================================================

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  completarProdutoDesconhecido,
  editarQuantidadeLeitura,
  finalizarConferencia,
  obterConferencia,
  obterLeiturasConferencia,
  obterResumoConferencia,
  removerLeituraConferencia,
  atualizarStatusLeitura,
} from '@/database/database';
import type {
  Conferencia,
  DadosProdutoRapido,
  LeituraConferencia,
  ResumoConferencia,
  StatusLeitura,
} from '@/models/produto';

// ============================================================
// CORES POR STATUS DE LEITURA
// ============================================================

const CORES_STATUS: Record<
  StatusLeitura,
  { fundo: string; borda: string; texto: string; etiqueta: string }
> = {
  normal: {
    fundo: '#EAF4FF',
    borda: '#208AEF',
    texto: '#175CD3',
    etiqueta: 'OK',
  },
  novo: {
    fundo: '#FFFBEA',
    borda: '#F2C94C',
    texto: '#9A7B00',
    etiqueta: 'NOVO',
  },
  desconhecido: {
    fundo: '#FFF1F0',
    borda: '#F04438',
    texto: '#B42318',
    etiqueta: 'DESCONHECIDO',
  },
};

// ============================================================
// TELA DE RESULTADO / REVISÃO DA CONFERÊNCIA
// ============================================================

export default function ResultadoScreen() {
  const { conferenciaId: conferenciaIdParam } =
    useLocalSearchParams<{ conferenciaId: string }>();

  const conferenciaId = Number(conferenciaIdParam);
  const conferenciaValida =
    Boolean(conferenciaIdParam) && !Number.isNaN(conferenciaId);

  const [conferencia, setConferencia] =
    useState<Conferencia | null>(null);

  const [leituras, setLeituras] =
    useState<LeituraConferencia[]>([]);

  const [resumo, setResumo] =
    useState<ResumoConferencia | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const [itemEditando, setItemEditando] =
    useState<LeituraConferencia | null>(null);

  // Modo revisão: a conferência ainda está em andamento,
  // então pode ser editada. Se já estiver finalizada
  // (aberta a partir do Histórico), é somente leitura.
  const modoRevisao = conferencia?.status === 'em_andamento';

  // ==========================================================
  // CARREGAR DADOS
  // ==========================================================

  async function carregarDados() {
    if (!conferenciaValida) {
      setCarregando(false);
      setErro('Conferência inválida.');
      return;
    }

    try {
      const [dadosConferencia, listaLeituras, resumoConferencia] =
        await Promise.all([
          obterConferencia(conferenciaId),
          obterLeiturasConferencia(conferenciaId),
          obterResumoConferencia(conferenciaId),
        ]);

      if (!dadosConferencia) {
        setErro('Conferência não encontrada.');
        setCarregando(false);
        return;
      }

      setConferencia(dadosConferencia);
      setLeituras(listaLeituras);
      setResumo(resumoConferencia);
      setCarregando(false);
    } catch (error) {
      console.error('Erro ao carregar resultado da conferência:', error);
      setErro('Não foi possível carregar o resultado.');
      setCarregando(false);
    }
  }

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      await carregarDados();
      if (!ativo) {
        return;
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenciaId, conferenciaValida]);

  // ==========================================================
  // RECARREGAR RESUMO (após edições)
  // ==========================================================

  async function recarregarResumo() {
    if (!conferenciaValida) {
      return;
    }

    const novoResumo = await obterResumoConferencia(conferenciaId);
    setResumo(novoResumo);
  }

  // ==========================================================
  // EDIÇÃO DE ITEM
  // ==========================================================

  function abrirEdicao(item: LeituraConferencia) {
    if (!modoRevisao) {
      return;
    }

    setItemEditando(item);
  }

  function fecharEdicao() {
    setItemEditando(null);
  }

  async function salvarQuantidade(novaQuantidade: number) {
    if (!itemEditando || !conferenciaValida) {
      return;
    }

    const quantidadeValida = Math.max(0, Math.floor(novaQuantidade));

    try {
      if (quantidadeValida === 0) {
        await removerLeituraConferencia(
          conferenciaId,
          itemEditando.produto.codigoInterno,
        );

        setLeituras((lista) =>
          lista.filter(
            (item) =>
              item.produto.codigoInterno !==
              itemEditando.produto.codigoInterno,
          ),
        );
      } else {
        await editarQuantidadeLeitura(
          conferenciaId,
          itemEditando.produto.codigoInterno,
          quantidadeValida,
        );

        setLeituras((lista) =>
          lista.map((item) =>
            item.produto.codigoInterno ===
            itemEditando.produto.codigoInterno
              ? { ...item, quantidade: quantidadeValida }
              : item,
          ),
        );
      }

      await recarregarResumo();
      fecharEdicao();
    } catch (error) {
      console.error('Erro ao editar quantidade:', error);
    }
  }

  async function removerItem() {
    if (!itemEditando || !conferenciaValida) {
      return;
    }

    try {
      await removerLeituraConferencia(
        conferenciaId,
        itemEditando.produto.codigoInterno,
      );

      setLeituras((lista) =>
        lista.filter(
          (item) =>
            item.produto.codigoInterno !==
            itemEditando.produto.codigoInterno,
        ),
      );

      await recarregarResumo();
      fecharEdicao();
    } catch (error) {
      console.error('Erro ao remover item:', error);
    }
  }

  async function salvarComoProdutoNovo(dados: DadosProdutoRapido) {
    if (!itemEditando || !conferenciaValida) {
      return;
    }

    try {
      await completarProdutoDesconhecido(
        itemEditando.produto.codigoInterno,
        dados,
      );

      await atualizarStatusLeitura(
        conferenciaId,
        itemEditando.produto.codigoInterno,
        'novo',
      );

      setLeituras((lista) =>
        lista.map((item) =>
          item.produto.codigoInterno ===
          itemEditando.produto.codigoInterno
            ? {
                ...item,
                status: 'novo',
                produto: {
                  ...item.produto,
                  nome: dados.nome,
                  marca: dados.marca,
                  categoria: dados.categoria,
                  origem: 'manual',
                },
              }
            : item,
        ),
      );

      fecharEdicao();
    } catch (error) {
      console.error('Erro ao salvar produto novo:', error);
    }
  }

  // ==========================================================
  // CONFIRMAR FINALIZAÇÃO DE VERDADE
  // ==========================================================

  async function confirmarFinalizacao() {
    if (!conferenciaValida || finalizando) {
      return;
    }

    setFinalizando(true);

    try {
      await finalizarConferencia(conferenciaId);
      router.replace('/');
    } catch (error) {
      console.error('Erro ao finalizar conferência:', error);
      setFinalizando(false);
    }
  }

  const totalUnidades = leituras.reduce(
    (total, item) => total + item.quantidade,
    0,
  );

// ============================================================
  // PARTE 2/2 — Interface, modal de edição e estilos
  // ============================================================

  // ==========================================================
  // CARREGANDO
  // ==========================================================

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Carregando resultado...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // ERRO
  // ==========================================================

  if (erro || !conferencia || !resumo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>

          <Text style={styles.errorText}>
            {erro ?? 'Não foi possível carregar o resultado.'}
          </Text>

          <Pressable
            style={styles.backButtonError}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonErrorText}>
              VOLTAR AO INÍCIO
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // INTERFACE PRINCIPAL
  // ==========================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conferencia.nome}
            </Text>

            <Text style={styles.headerSubtitle}>
              {modoRevisao
                ? 'Revisão antes de finalizar'
                : conferencia.status === 'cancelada'
                ? 'Cancelada'
                : 'Finalizada'}
            </Text>
          </View>

          <View style={styles.headerSpace} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* Resumo */}
          <View style={styles.summaryCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>
                {modoRevisao
                  ? '📋'
                  : conferencia.status === 'cancelada'
                  ? '🗑️'
                  : '✓'}
              </Text>
            </View>

            <Text style={styles.summaryTitle}>
              {modoRevisao
                ? 'REVISE ANTES DE FINALIZAR'
                : conferencia.status === 'cancelada'
                ? 'CONFERÊNCIA CANCELADA'
                : 'CONFERÊNCIA FINALIZADA'}
            </Text>

            <Text style={styles.summaryDescription}>
              {modoRevisao
                ? 'Toque em um produto para corrigir a quantidade.'
                : 'A leitura dos produtos foi concluída.'}
            </Text>

            <View style={styles.summaryNumbers}>
              <View style={styles.numberItem}>
                <Text style={styles.numberValue}>
                  {resumo.produtosLidos}
                </Text>
                <Text style={styles.numberLabel}>Produtos</Text>
              </View>

              <View style={styles.numberDivider} />

              <View style={styles.numberItem}>
                <Text style={styles.numberValue}>
                  {totalUnidades}
                </Text>
                <Text style={styles.numberLabel}>Itens</Text>
              </View>

              {resumo.produtosNaoEncontrados > 0 && (
                <>
                  <View style={styles.numberDivider} />

                  <View style={styles.numberItem}>
                    <Text
                      style={[styles.numberValue, styles.numberValueAlerta]}
                    >
                      {resumo.produtosNaoEncontrados}
                    </Text>
                    <Text style={styles.numberLabel}>Não identif.</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Orientação */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionIcon}>📄</Text>

            <View style={styles.instructionInfo}>
              <Text style={styles.instructionTitle}>
                {modoRevisao
                  ? 'Confira antes de confirmar'
                  : 'Agora confira com a nota fiscal'}
              </Text>

              <Text style={styles.instructionText}>
                {modoRevisao
                  ? 'Corrija quantidades ou remova itens lidos por engano. Depois de confirmar, não será possível editar.'
                  : 'Compare os produtos lidos com a nota fiscal e registre qualquer divergência.'}
              </Text>
            </View>
          </View>

          {/* Produtos */}
          <Text style={styles.sectionTitle}>PRODUTOS CONFERIDOS</Text>

          {leituras.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Nenhum produto foi lido nesta conferência.
              </Text>
            </View>
          ) : (
            leituras.map((item) => {
              const cor = CORES_STATUS[item.status];

              return (
                <Pressable
                  key={item.produto.codigoInterno}
                  style={[
                    styles.productCard,
                    { borderColor: cor.borda, backgroundColor: cor.fundo },
                  ]}
                  onPress={() => abrirEdicao(item)}
                  disabled={!modoRevisao}
                >
                  <View
                    style={[
                      styles.productCodeBox,
                      { backgroundColor: cor.borda },
                    ]}
                  >
                    <Text style={styles.productCode}>
                      {item.produto.codigoInterno}
                    </Text>
                  </View>

                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>
                      {item.produto.nome}
                    </Text>

                    <View style={styles.productMetaRow}>
                      <Text style={styles.productQuantity}>
                        Quantidade lida: {item.quantidade}
                      </Text>

                      <View
                        style={[
                          styles.badgeSmall,
                          { backgroundColor: cor.borda },
                        ]}
                      >
                        <Text style={styles.badgeSmallText}>
                          {cor.etiqueta}
                        </Text>
                      </View>
                    </View>

                    {modoRevisao && (
                      <Text style={styles.editHint}>toque para editar</Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}

        </ScrollView>

        {/* Ações */}
        {modoRevisao ? (
          <>
            <Pressable
              style={[
                styles.confirmButton,
                finalizando && styles.buttonDisabled,
              ]}
              onPress={() => {
                void confirmarFinalizacao();
              }}
              disabled={finalizando}
            >
              {finalizando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.confirmIcon}>✓</Text>
                  <Text style={styles.confirmText}>
                    CONFIRMAR E FINALIZAR
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.newButton}
              onPress={() => router.back()}
              disabled={finalizando}
            >
              <Text style={styles.newText}>CONTINUAR LENDO</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={styles.confirmButton}
            onPress={() => router.back()}
          >
            <Text style={styles.confirmText}>VOLTAR</Text>
          </Pressable>
        )}

      </View>

      {/* Modal de edição */}
      {itemEditando && (
        <ModalEdicaoItem
          item={itemEditando}
          onFechar={fecharEdicao}
          onSalvarQuantidade={salvarQuantidade}
          onRemover={removerItem}
          onSalvarProdutoNovo={salvarComoProdutoNovo}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// MODAL DE EDIÇÃO DE UM ITEM
// ============================================================

type ModalEdicaoItemProps = {
  item: LeituraConferencia;
  onFechar: () => void;
  onSalvarQuantidade: (novaQuantidade: number) => void;
  onRemover: () => void;
  onSalvarProdutoNovo: (dados: DadosProdutoRapido) => void;
};

function ModalEdicaoItem({
  item,
  onFechar,
  onSalvarQuantidade,
  onRemover,
  onSalvarProdutoNovo,
}: ModalEdicaoItemProps) {
  const [quantidadeTexto, setQuantidadeTexto] = useState(
    String(item.quantidade),
  );

  const [nome, setNome] = useState(
    item.status === 'desconhecido' ? '' : item.produto.nome,
  );

  const [marca, setMarca] = useState(item.produto.marca ?? '');
  const [categoria, setCategoria] = useState(item.produto.categoria ?? '');

  const ehDesconhecido = item.status === 'desconhecido';

  return (
    <View style={styles.overlay}>
      <View style={styles.editCard}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.editBarcode}>
            {item.produto.codigoBarras || 'sem código de barras'}
          </Text>

          {ehDesconhecido ? (
            <>
              <Text style={styles.editTitle}>
                PRODUTO NÃO IDENTIFICADO
              </Text>

              <Text style={styles.editSubtitle}>
                Preencha o nome para salvar este
                código como um produto novo.
              </Text>

              <Text style={styles.editLabel}>NOME *</Text>
              <TextInput
                style={styles.editInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome do produto"
                placeholderTextColor="#98A2B3"
              />

              <Text style={styles.editLabel}>MARCA</Text>
              <TextInput
                style={styles.editInput}
                value={marca}
                onChangeText={setMarca}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
              />

              <Text style={styles.editLabel}>CATEGORIA</Text>
              <TextInput
                style={styles.editInput}
                value={categoria}
                onChangeText={setCategoria}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
              />

              <Pressable
                style={[
                  styles.editSaveButton,
                  !nome.trim() && styles.editButtonDisabled,
                ]}
                disabled={!nome.trim()}
                onPress={() =>
                  onSalvarProdutoNovo({
                    nome: nome.trim(),
                    marca: marca.trim() || undefined,
                    categoria: categoria.trim() || undefined,
                  })
                }
              >
                <Text style={styles.editSaveButtonText}>
                  SALVAR COMO PRODUTO NOVO
                </Text>
              </Pressable>

              <View style={styles.editDivider} />
            </>
          ) : (
            <Text style={styles.editTitle}>{item.produto.nome}</Text>
          )}

          <Text style={styles.editLabel}>QUANTIDADE</Text>
          <TextInput
            style={styles.editInput}
            value={quantidadeTexto}
            onChangeText={setQuantidadeTexto}
            keyboardType="number-pad"
          />

          <Pressable
            style={styles.editSaveButton}
            onPress={() =>
              onSalvarQuantidade(Number(quantidadeTexto) || 0)
            }
          >
            <Text style={styles.editSaveButtonText}>
              SALVAR QUANTIDADE
            </Text>
          </Pressable>

          <Pressable style={styles.editRemoveButton} onPress={onRemover}>
            <Text style={styles.editRemoveButtonText}>
              REMOVER DA CONFERÊNCIA
            </Text>
          </Pressable>

          <Pressable style={styles.editCancelButton} onPress={onFechar}>
            <Text style={styles.editCancelButtonText}>CANCELAR</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
  },

  errorIcon: {
    fontSize: 42,
    marginBottom: 14,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
    textAlign: 'center',
  },

  backButtonError: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: '#208AEF',
  },

  backButtonErrorText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  scrollContent: {
    paddingBottom: 20,
  },

  // Cabeçalho
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    fontSize: 38,
    lineHeight: 42,
    color: '#18212F',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18212F',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#667085',
  },

  headerSpace: {
    width: 44,
  },

  // Resumo
  summaryCard: {
    marginTop: 12,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    elevation: 2,
  },

  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successIconText: {
    fontSize: 28,
    color: '#12B76A',
  },

  summaryTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '800',
    color: '#18212F',
    textAlign: 'center',
  },

  summaryDescription: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    color: '#667085',
  },

  summaryNumbers: {
    width: '100%',
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },

  numberItem: {
    flex: 1,
    alignItems: 'center',
  },

  numberValue: {
    fontSize: 25,
    fontWeight: '800',
    color: '#208AEF',
  },

  numberValueAlerta: {
    color: '#F04438',
  },

  numberLabel: {
    marginTop: 3,
    fontSize: 11,
    color: '#667085',
    textAlign: 'center',
  },

  numberDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E4E7EC',
  },

  // Instrução
  instructionCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EFF8FF',
    flexDirection: 'row',
  },

  instructionIcon: {
    fontSize: 25,
    marginRight: 12,
  },

  instructionInfo: {
    flex: 1,
  },

  instructionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#175CD3',
  },

  instructionText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#344054',
  },

  // Produtos
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#667085',
  },

  emptyCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  emptyText: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
  },

  productCard: {
    minHeight: 66,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },

  productCodeBox: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },

  productCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  productInfo: {
    flex: 1,
    marginLeft: 12,
  },

  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18212F',
  },

  productMetaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  productQuantity: {
    fontSize: 12,
    color: '#667085',
  },

  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  badgeSmallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  editHint: {
    marginTop: 4,
    fontSize: 9,
    color: '#98A2B3',
  },

  // Confirmação
  confirmButton: {
    height: 58,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#12B76A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  confirmIcon: {
    fontSize: 21,
    color: '#FFFFFF',
    marginRight: 10,
  },

  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Continuar / voltar
  newButton: {
    height: 54,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
  },

  // Modal de edição (mesmo estilo de leitura.tsx)
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  editCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  editBarcode: {
    fontSize: 11,
    color: '#98A2B3',
    textAlign: 'center',
  },

  editTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  editSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#667085',
    textAlign: 'center',
  },

  editLabel: {
    marginTop: 16,
    fontSize: 10,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  editInput: {
    marginTop: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#18212F',
  },

  editSaveButton: {
    height: 50,
    marginTop: 18,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editButtonDisabled: {
    opacity: 0.5,
  },

  editSaveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  editDivider: {
    height: 1,
    backgroundColor: '#EEF1F4',
    marginTop: 20,
  },

  editRemoveButton: {
    height: 48,
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editRemoveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F04438',
  },

 editCancelButton: {
    height: 46,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },
});

