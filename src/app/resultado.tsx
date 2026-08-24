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
  atualizarStatusLeitura,
  completarProdutoDesconhecido,
  editarQuantidadeLeitura,
  finalizarConferencia,
  marcarStatusRevisao,
  obterConferencia,
  obterLeiturasConferencia,
  obterResumoConferencia,
  obterResumoRevisao,
  removerLeituraConferencia,
} from '@/database/database';
import type {
  Conferencia,
  DadosProdutoRapido,
  LeituraConferencia,
  ResumoConferencia,
  ResumoRevisao,
  StatusLeitura,
  StatusRevisao,
} from '@/models/produto';
import { CORES_STATUS } from '@/constants/cores';

// ============================================================
// TELA DE RESULTADO / REVISÃO DA CONFERÊNCIA
// ============================================================

export default function ResultadoScreen() {
  const { conferenciaId: conferenciaIdParam } =
    useLocalSearchParams<{ conferenciaId: string }>();

  const conferenciaId = Number(conferenciaIdParam);
  const conferenciaValida =
    Boolean(conferenciaIdParam) && !Number.isNaN(conferenciaId);

  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [leituras, setLeituras] = useState<LeituraConferencia[]>([]);
  const [resumo, setResumo] = useState<ResumoConferencia | null>(null);
  const [resumoRevisao, setResumoRevisao] = useState<ResumoRevisao | null>(
    null,
  );

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarConfirmacaoFinalizar, setMostrarConfirmacaoFinalizar] =
    useState(false);

  const [itemEditando, setItemEditando] =
    useState<LeituraConferencia | null>(null);

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
      const [dadosConferencia, listaLeituras, resumoConferencia, resumoRev] =
        await Promise.all([
          obterConferencia(conferenciaId),
          obterLeiturasConferencia(conferenciaId),
          obterResumoConferencia(conferenciaId),
          obterResumoRevisao(conferenciaId),
        ]);

      if (!dadosConferencia) {
        setErro('Conferência não encontrada.');
        setCarregando(false);
        return;
      }

      setConferencia(dadosConferencia);
      setLeituras(listaLeituras);
      setResumo(resumoConferencia);
      setResumoRevisao(resumoRev);
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
  // RECARREGAR RESUMOS
  // ==========================================================

  async function recarregarResumos() {
    if (!conferenciaValida) {
      return;
    }

    const [novoResumo, novoResumoRevisao] = await Promise.all([
      obterResumoConferencia(conferenciaId),
      obterResumoRevisao(conferenciaId),
    ]);

    setResumo(novoResumo);
    setResumoRevisao(novoResumoRevisao);
  }

  // ==========================================================
  // REVISÃO — MARCAR STATUS DE UM ITEM
  // ==========================================================

  async function alterarRevisao(
    item: LeituraConferencia,
    novoStatus: StatusRevisao,
  ) {
    if (!conferenciaValida) {
      return;
    }

    // Tocar no status já ativo desmarca (volta a pendente).
    const statusFinal =
      item.statusRevisao === novoStatus && novoStatus !== 'pendente'
        ? 'pendente'
        : novoStatus;

    try {
      await marcarStatusRevisao(
        conferenciaId,
        item.produto.codigoInterno,
        statusFinal,
      );

      setLeituras((lista) =>
        lista.map((l) =>
          l.produto.codigoInterno === item.produto.codigoInterno
            ? { ...l, statusRevisao: statusFinal }
            : l,
        ),
      );

      const novoResumoRevisao = await obterResumoRevisao(conferenciaId);
      setResumoRevisao(novoResumoRevisao);
    } catch (error) {
      console.error('Erro ao marcar status de revisão:', error);
    }
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

        // Editar quantidade de um item marcado OK reverte para pendente.
        const statusRevisaoAtual = itemEditando.statusRevisao;
        let novoStatusRevisao = statusRevisaoAtual;

        if (statusRevisaoAtual === 'ok') {
          await marcarStatusRevisao(
            conferenciaId,
            itemEditando.produto.codigoInterno,
            'pendente',
          );
          novoStatusRevisao = 'pendente';
        }

        setLeituras((lista) =>
          lista.map((item) =>
            item.produto.codigoInterno ===
            itemEditando.produto.codigoInterno
              ? {
                  ...item,
                  quantidade: quantidadeValida,
                  statusRevisao: novoStatusRevisao,
                }
              : item,
          ),
        );
      }

      await recarregarResumos();
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

      await recarregarResumos();
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
                status: 'novo' as StatusLeitura,
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
  // CONFIRMAR FINALIZAÇÃO
  // ==========================================================

  async function confirmarFinalizacao() {
    if (!conferenciaValida || finalizando) {
      return;
    }

    setFinalizando(true);
    setMostrarConfirmacaoFinalizar(false);

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
            <Text style={styles.backButtonErrorText}>VOLTAR AO INÍCIO</Text>
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

          {/* Resumo de contagens */}
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
                ? 'Marque cada produto e corrija quantidades se necessário.'
                : 'A leitura dos produtos foi concluída.'}
            </Text>

            <View style={styles.summaryNumbers}>
              <View style={styles.numberItem}>
                <Text style={styles.numberValue}>{resumo.produtosLidos}</Text>
                <Text style={styles.numberLabel}>Produtos</Text>
              </View>

              <View style={styles.numberDivider} />

              <View style={styles.numberItem}>
                <Text style={styles.numberValue}>{totalUnidades}</Text>
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

          {/* Barra de progresso de revisão (somente modo revisão) */}
          {modoRevisao && resumoRevisao && (
            <View style={styles.revisaoBar}>
              <View style={styles.revisaoItem}>
                <Text style={styles.revisaoNumOk}>{resumoRevisao.ok}</Text>
                <Text style={styles.revisaoLabelOk}>OK</Text>
              </View>

              <View style={styles.revisaoSeparator} />

              <View style={styles.revisaoItem}>
                <Text style={styles.revisaoNumDiv}>
                  {resumoRevisao.divergencia}
                </Text>
                <Text style={styles.revisaoLabelDiv}>Divergência</Text>
              </View>

              <View style={styles.revisaoSeparator} />

              <View style={styles.revisaoItem}>
                <Text style={styles.revisaoNumPend}>
                  {resumoRevisao.pendente}
                </Text>
                <Text style={styles.revisaoLabelPend}>Pendente</Text>
              </View>
            </View>
          )}

          {/* Instrução */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionIcon}>📄</Text>

            <View style={styles.instructionInfo}>
              <Text style={styles.instructionTitle}>
                {modoRevisao
                  ? 'Compare com a nota fiscal'
                  : 'Agora confira com a nota fiscal'}
              </Text>

              <Text style={styles.instructionText}>
                {modoRevisao
                  ? 'Marque OK, Divergência ou deixe Pendente. Toque no produto para editar a quantidade.'
                  : 'Compare os produtos lidos com a nota fiscal e registre qualquer divergência.'}
              </Text>
            </View>
          </View>

          {/* Lista de produtos */}
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
                <View
                  key={item.produto.codigoInterno}
                  style={[
                    styles.productCard,
                    { borderColor: cor.borda, backgroundColor: cor.fundo },
                  ]}
                >
                  {/* Área clicável para editar quantidade */}
                  <Pressable
                    style={styles.productMain}
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
                          Qtd: {item.quantidade}
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
                        <Text style={styles.editHint}>
                          toque para editar quantidade
                        </Text>
                      )}
                    </View>
                  </Pressable>

                  {/* Botões de revisão */}
                  {modoRevisao && (
                    <View style={styles.revisaoBotoes}>
                      <Pressable
                        style={[
                          styles.btnRevisao,
                          styles.btnOk,
                          item.statusRevisao === 'ok' &&
                            styles.btnOkAtivo,
                        ]}
                        onPress={() => void alterarRevisao(item, 'ok')}
                      >
                        <Text
                          style={[
                            styles.btnRevisaoTexto,
                            item.statusRevisao === 'ok' &&
                              styles.btnOkTextoAtivo,
                          ]}
                        >
                          ✓ OK
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.btnRevisao,
                          styles.btnDiv,
                          item.statusRevisao === 'divergencia' &&
                            styles.btnDivAtivo,
                        ]}
                        onPress={() =>
                          void alterarRevisao(item, 'divergencia')
                        }
                      >
                        <Text
                          style={[
                            styles.btnRevisaoTexto,
                            item.statusRevisao === 'divergencia' &&
                              styles.btnDivTextoAtivo,
                          ]}
                        >
                          ✗ Div.
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.btnRevisao,
                          styles.btnPend,
                          item.statusRevisao === 'pendente' &&
                            styles.btnPendAtivo,
                        ]}
                        onPress={() =>
                          void alterarRevisao(item, 'pendente')
                        }
                      >
                        <Text
                          style={[
                            styles.btnRevisaoTexto,
                            item.statusRevisao === 'pendente' &&
                              styles.btnPendTextoAtivo,
                          ]}
                        >
                          — Pend.
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
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
              onPress={() => setMostrarConfirmacaoFinalizar(true)}
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

      {/* Modal de edição de item */}
      {itemEditando && (
        <ModalEdicaoItem
          item={itemEditando}
          onFechar={fecharEdicao}
          onSalvarQuantidade={salvarQuantidade}
          onRemover={removerItem}
          onSalvarProdutoNovo={salvarComoProdutoNovo}
        />
      )}

      {/* Modal de confirmação de finalização */}
      {mostrarConfirmacaoFinalizar && resumoRevisao && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmCardIcon}>📋</Text>

            <Text style={styles.confirmCardTitle}>
              FINALIZAR CONFERÊNCIA?
            </Text>

            <Text style={styles.confirmCardSubtitle}>
              Resumo da revisão:
            </Text>

            <View style={styles.confirmResumoRow}>
              <View style={[styles.confirmResumoItem, styles.confirmResumoOk]}>
                <Text style={styles.confirmResumoNum}>
                  {resumoRevisao.ok}
                </Text>
                <Text style={styles.confirmResumoLabel}>OK</Text>
              </View>

              <View
                style={[styles.confirmResumoItem, styles.confirmResumoDiv]}
              >
                <Text style={styles.confirmResumoNum}>
                  {resumoRevisao.divergencia}
                </Text>
                <Text style={styles.confirmResumoLabel}>Divergência</Text>
              </View>

              <View
                style={[styles.confirmResumoItem, styles.confirmResumoPend]}
              >
                <Text style={styles.confirmResumoNum}>
                  {resumoRevisao.pendente}
                </Text>
                <Text style={styles.confirmResumoLabel}>Pendente</Text>
              </View>
            </View>

            {resumoRevisao.pendente > 0 && (
              <Text style={styles.confirmAviso}>
                ⚠️ Ainda há {resumoRevisao.pendente} produto(s) pendente(s)
                de revisão. Você pode finalizar mesmo assim.
              </Text>
            )}

            <Pressable
              style={styles.confirmFinalButton}
              onPress={() => void confirmarFinalizacao()}
              disabled={finalizando}
            >
              {finalizando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmFinalButtonText}>
                  SIM, FINALIZAR
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.confirmCancelButton}
              onPress={() => setMostrarConfirmacaoFinalizar(false)}
              disabled={finalizando}
            >
              <Text style={styles.confirmCancelButtonText}>
                VOLTAR À REVISÃO
              </Text>
            </Pressable>
          </View>
        </View>
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
              <Text style={styles.editTitle}>PRODUTO NÃO IDENTIFICADO</Text>

              <Text style={styles.editSubtitle}>
                Preencha o nome para salvar este código como um produto novo.
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
            onPress={() => onSalvarQuantidade(Number(quantidadeTexto) || 0)}
          >
            <Text style={styles.editSaveButtonText}>SALVAR QUANTIDADE</Text>
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

  // Barra de progresso de revisão
  revisaoBar: {
    marginTop: 12,
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    overflow: 'hidden',
  },

  revisaoItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },

  revisaoSeparator: {
    width: 1,
    backgroundColor: '#E4E7EC',
  },

  revisaoNumOk: {
    fontSize: 20,
    fontWeight: '800',
    color: '#12B76A',
  },

  revisaoLabelOk: {
    fontSize: 10,
    fontWeight: '700',
    color: '#12B76A',
  },

  revisaoNumDiv: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F04438',
  },

  revisaoLabelDiv: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F04438',
  },

  revisaoNumPend: {
    fontSize: 20,
    fontWeight: '800',
    color: '#98A2B3',
  },

  revisaoLabelPend: {
    fontSize: 10,
    fontWeight: '700',
    color: '#98A2B3',
  },

  instructionCard: {
    marginTop: 12,
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
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },

  productMain: {
    padding: 12,
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

  // Botões de revisão
  revisaoBotoes: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },

  btnRevisao: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnOk: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.06)',
  },

  btnOkAtivo: {
    backgroundColor: '#12B76A',
  },

  btnDiv: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.06)',
  },

  btnDivAtivo: {
    backgroundColor: '#F04438',
  },

  btnPend: {},

  btnPendAtivo: {
    backgroundColor: '#98A2B3',
  },

  btnRevisaoTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
  },

  btnOkTextoAtivo: {
    color: '#FFFFFF',
  },

  btnDivTextoAtivo: {
    color: '#FFFFFF',
  },

  btnPendTextoAtivo: {
    color: '#FFFFFF',
  },

  // Ações
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

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  // Modal de confirmação de finalização
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },

  confirmCardIcon: {
    fontSize: 34,
    marginBottom: 8,
  },

  confirmCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  confirmCardSubtitle: {
    marginTop: 10,
    fontSize: 13,
    color: '#667085',
  },

  confirmResumoRow: {
    marginTop: 12,
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },

  confirmResumoItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },

  confirmResumoOk: {
    backgroundColor: '#ECFDF3',
  },

  confirmResumoDiv: {
    backgroundColor: '#FFF1F0',
  },

  confirmResumoPend: {
    backgroundColor: '#F2F4F7',
  },

  confirmResumoNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#18212F',
  },

  confirmResumoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#667085',
    marginTop: 2,
  },

  confirmAviso: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    color: '#B54708',
    textAlign: 'center',
    backgroundColor: '#FFFAEB',
    padding: 10,
    borderRadius: 10,
    width: '100%',
  },

  confirmFinalButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 18,
    borderRadius: 13,
    backgroundColor: '#12B76A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmFinalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  confirmCancelButton: {
    width: '100%',
    minHeight: 48,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667085',
  },

  // Modal de edição de item
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
