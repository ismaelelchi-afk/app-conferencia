// ============================================================
// CONSULTA DE PRODUTO — RAMSONS CONFERÊNCIA
// Parte 1/2 — Lógica, buscador e interface
// ============================================================

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atualizarProduto, buscarProdutos } from '@/database/database';
import type { Produto } from '@/models/produto';

// ============================================================
// TELA
// ============================================================

export default function ConsultaProdutoScreen() {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);

  // ==========================================================
  // BUSCAR COM PEQUENO ATRASO (evita disparar uma consulta
  // a cada tecla digitada)
  // ==========================================================

  useEffect(() => {
    const termoLimpo = termo.trim();

    if (termoLimpo.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);

    const timeoutId = setTimeout(async () => {
      try {
        const lista = await buscarProdutos(termoLimpo);
        setResultados(lista);
      } catch (error) {
        console.error('Erro ao buscar produtos:', error);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [termo]);

  // ==========================================================
  // ABRIR LINK NO NAVEGADOR PADRÃO
  // ==========================================================

  async function abrirLink(url: string) {
    try {
      const suportado = await Linking.canOpenURL(url);

      if (suportado) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Erro ao abrir link:', error);
    }
  }

  // ==========================================================
  // ATUALIZAR PRODUTO APÓS EDIÇÃO
  // Reflete a mudança tanto na lista de resultados quanto
  // no modal aberto, sem precisar buscar de novo.
  // ==========================================================

  function handleProdutoAtualizado(produtoAtualizado: Produto) {
    setResultados((lista) =>
      lista.map((item) =>
        item.codigoInterno === produtoAtualizado.codigoInterno
          ? produtoAtualizado
          : item,
      ),
    );

    setProdutoSelecionado(produtoAtualizado);
  }

  // ==========================================================
  // INTERFACE
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

          <Text style={styles.headerTitle}>
            CONSULTAR PRODUTO
          </Text>

          <View style={styles.headerSpace} />
        </View>

        {/* Buscador */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Código interno, código de barras ou nome"
            placeholderTextColor="#98A2B3"
            value={termo}
            onChangeText={setTermo}
            autoCapitalize="none"
          />

          {buscando && <ActivityIndicator size="small" />}
        </View>

        {/* Resultados */}
        {termo.trim().length < 2 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>
              Digite pelo menos 2 caracteres para buscar.
            </Text>
          </View>
        ) : !buscando && resultados.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              Nenhum produto encontrado para "{termo}".
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {resultados.map((produto) => (
              <Pressable
                key={produto.codigoInterno}
                style={styles.card}
                onPress={() => setProdutoSelecionado(produto)}
              >
                <Text style={styles.cardName} numberOfLines={2}>
                  {produto.nome}
                </Text>

                <View style={styles.cardMeta}>
                  <Text style={styles.cardCode}>
                    {produto.codigoInterno}
                  </Text>

                  {produto.marca && (
                    <Text style={styles.cardBrand}>{produto.marca}</Text>
                  )}
                </View>

                <Text style={styles.cardBarcode}>
                  {produto.codigoBarras || 'sem código de barras'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Modal de detalhe / edição */}
      {produtoSelecionado && (
        <DetalheProdutoModal
          produto={produtoSelecionado}
          onFechar={() => setProdutoSelecionado(null)}
          onAbrirLink={abrirLink}
          onProdutoAtualizado={handleProdutoAtualizado}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// PARTE 2/2 — Modal de detalhe/edição do produto + estilos
// ============================================================

// ============================================================
// MODAL DE DETALHE / EDIÇÃO DO PRODUTO
// ============================================================

type DetalheProdutoModalProps = {
  produto: Produto;
  onFechar: () => void;
  onAbrirLink: (url: string) => void;
  onProdutoAtualizado: (produto: Produto) => void;
};

function DetalheProdutoModal({
  produto,
  onFechar,
  onAbrirLink,
  onProdutoAtualizado,
}: DetalheProdutoModalProps) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState(produto.nome);
  const [codigoBarras, setCodigoBarras] = useState(produto.codigoBarras);
  const [marca, setMarca] = useState(produto.marca ?? '');
  const [categoria, setCategoria] = useState(produto.categoria ?? '');
  const [modelo, setModelo] = useState(produto.modelo ?? '');
  const [unidade, setUnidade] = useState(produto.unidade ?? 'UN');
  const [estoque, setEstoque] = useState(String(produto.estoque ?? 0));

  const especificacoes = produto.especificacoes
    ? Object.entries(produto.especificacoes)
    : [];

  const nomeValido = nome.trim().length >= 3;

  // ==========================================================
  // INICIAR EDIÇÃO
  // Sempre "recarrega" os campos a partir do produto atual,
  // para nunca mostrar dados de uma edição anterior.
  // ==========================================================

  function comecarEdicao() {
    setNome(produto.nome);
    setCodigoBarras(produto.codigoBarras);
    setMarca(produto.marca ?? '');
    setCategoria(produto.categoria ?? '');
    setModelo(produto.modelo ?? '');
    setUnidade(produto.unidade ?? 'UN');
    setEstoque(String(produto.estoque ?? 0));
    setErro(null);
    setEditando(true);
  }

  // ==========================================================
  // SALVAR EDIÇÃO
  // Marca o produto como 'manual' para que uma futura
  // reimportação do catálogo embutido não sobrescreva a
  // correção feita aqui.
  // ==========================================================

  async function salvarEdicao() {
    if (!nomeValido || salvando) {
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const produtoAtualizado: Produto = {
        ...produto,
        nome: nome.trim(),
        codigoBarras: codigoBarras.trim(),
        marca: marca.trim() || undefined,
        categoria: categoria.trim() || undefined,
        modelo: modelo.trim() || undefined,
        unidade: unidade.trim() || 'UN',
        estoque: Number(estoque) || 0,
        origem: 'manual',
      };

      const sucesso = await atualizarProduto(produtoAtualizado);

      if (!sucesso) {
        setErro('Não foi possível salvar: produto não encontrado.');
        return;
      }

      onProdutoAtualizado(produtoAtualizado);
      setEditando(false);
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      setErro(
        'Não foi possível salvar. Verifique se o código de barras já não está em uso por outro produto.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>
            {editando ? 'EDITAR PRODUTO' : 'DETALHES DO PRODUTO'}
          </Text>

          <Pressable onPress={onFechar} style={styles.detailCloseButton}>
            <Text style={styles.detailCloseIcon}>✕</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {erro && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{erro}</Text>
            </View>
          )}

          {editando ? (
            <>
              <Text style={styles.editLabel}>CÓDIGO INTERNO</Text>
              <View style={styles.readOnlyBox}>
                <Text style={styles.readOnlyText}>
                  {produto.codigoInterno}
                </Text>
              </View>

              <Text style={styles.editLabel}>NOME *</Text>
              <TextInput
                style={styles.editInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome do produto"
                placeholderTextColor="#98A2B3"
                editable={!salvando}
              />

              <Text style={styles.editLabel}>CÓDIGO DE BARRAS</Text>
              <TextInput
                style={styles.editInput}
                value={codigoBarras}
                onChangeText={setCodigoBarras}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                editable={!salvando}
              />

              <Text style={styles.editLabel}>MARCA</Text>
              <TextInput
                style={styles.editInput}
                value={marca}
                onChangeText={setMarca}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
                editable={!salvando}
              />

              <Text style={styles.editLabel}>CATEGORIA</Text>
              <TextInput
                style={styles.editInput}
                value={categoria}
                onChangeText={setCategoria}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
                editable={!salvando}
              />

              <Text style={styles.editLabel}>MODELO</Text>
              <TextInput
                style={styles.editInput}
                value={modelo}
                onChangeText={setModelo}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
                editable={!salvando}
              />

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.editLabel}>UNIDADE</Text>
                  <TextInput
                    style={styles.editInput}
                    value={unidade}
                    onChangeText={(valor) =>
                      setUnidade(valor.toUpperCase().slice(0, 8))
                    }
                    placeholder="UN"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="characters"
                    editable={!salvando}
                  />
                </View>

                <View style={styles.rowItem}>
                  <Text style={styles.editLabel}>ESTOQUE</Text>
                  <TextInput
                    style={styles.editInput}
                    value={estoque}
                    onChangeText={setEstoque}
                    placeholder="0"
                    placeholderTextColor="#98A2B3"
                    keyboardType="number-pad"
                    editable={!salvando}
                  />
                </View>
              </View>

              <Pressable
                style={[
                  styles.saveButton,
                  (!nomeValido || salvando) && styles.buttonDisabled,
                ]}
                onPress={() => {
                  void salvarEdicao();
                }}
                disabled={!nomeValido || salvando}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    SALVAR ALTERAÇÕES
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelEditButton}
                onPress={() => {
                  setEditando(false);
                  setErro(null);
                }}
                disabled={salvando}
              >
                <Text style={styles.cancelEditButtonText}>CANCELAR</Text>
              </Pressable>

              <View style={styles.editDividerBig} />
            </>
          ) : (
            <>
              <Text style={styles.detailName}>{produto.nome}</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Código interno</Text>
                <Text style={styles.detailValue}>
                  {produto.codigoInterno}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Código de barras</Text>
                <Text style={styles.detailValue}>
                  {produto.codigoBarras || 'não informado'}
                </Text>
              </View>

              {produto.marca && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Marca</Text>
                  <Text style={styles.detailValue}>{produto.marca}</Text>
                </View>
              )}

              {produto.categoria && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Categoria</Text>
                  <Text style={styles.detailValue}>
                    {produto.categoria}
                  </Text>
                </View>
              )}

              {produto.modelo && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Modelo</Text>
                  <Text style={styles.detailValue}>{produto.modelo}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Unidade</Text>
                <Text style={styles.detailValue}>
                  {produto.unidade || 'UN'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estoque</Text>
                <Text style={styles.detailValue}>
                  {produto.estoque ?? 0}
                </Text>
              </View>

              <Pressable style={styles.editButton} onPress={comecarEdicao}>
                <Text style={styles.editButtonText}>
                  ✏️ EDITAR PRODUTO
                </Text>
              </Pressable>
            </>
          )}

          {produto.url && (
            <Pressable
              style={styles.linkButton}
              onPress={() => onAbrirLink(produto.url!)}
            >
              <Text style={styles.linkButtonText}>
                🔗 ABRIR PÁGINA DO PRODUTO
              </Text>
            </Pressable>
          )}

          {especificacoes.length > 0 && (
            <>
              <Text style={styles.detailSectionTitle}>
                ESPECIFICAÇÕES TÉCNICAS
              </Text>

              <View style={styles.specsCard}>
                {especificacoes.map(([chave, valor]) => (
                  <View key={chave} style={styles.specRow}>
                    <Text style={styles.specLabel}>{chave}</Text>
                    <Text style={styles.specValue}>{valor}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
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

  content: {
    flex: 1,
    paddingHorizontal: 20,
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

  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#18212F',
    textAlign: 'center',
  },

  headerSpace: {
    width: 44,
  },

  // Buscador
  searchBox: {
    height: 50,
    marginTop: 8,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  searchIcon: {
    fontSize: 16,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#18212F',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
    textAlign: 'center',
  },

  list: {
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },

  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },

  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18212F',
  },

  cardMeta: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  cardCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#208AEF',
  },

  cardBrand: {
    fontSize: 12,
    color: '#667085',
  },

  cardBarcode: {
    marginTop: 4,
    fontSize: 11,
    color: '#98A2B3',
  },

  // Modal de detalhe / edição
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  detailCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  detailHeaderTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  detailCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailCloseIcon: {
    fontSize: 14,
    color: '#475467',
  },

  detailName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#18212F',
    marginBottom: 14,
  },

  detailRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },

  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#98A2B3',
    letterSpacing: 0.5,
  },

  detailValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: '#18212F',
  },

  editButton: {
    height: 48,
    marginTop: 18,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#208AEF',
  },

  linkButton: {
    height: 48,
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  linkButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  detailSectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  specsCard: {
    borderRadius: 13,
    backgroundColor: '#F9FAFB',
    padding: 4,
    marginBottom: 10,
  },

  specRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
  },

  specLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#98A2B3',
  },

  specValue: {
    marginTop: 2,
    fontSize: 13,
    color: '#344054',
  },

  // ----------------------------------------------------------
  // MODO EDIÇÃO
  // ----------------------------------------------------------

  errorBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF1F0',
    marginBottom: 14,
  },

  errorBoxText: {
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
  },

  readOnlyBox: {
    marginTop: 6,
    height: 44,
    borderRadius: 11,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  readOnlyText: {
    fontSize: 14,
    color: '#667085',
  },

  editLabel: {
    marginTop: 14,
    fontSize: 10,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.5,
  },

  editInput: {
    marginTop: 6,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#18212F',
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  rowItem: {
    flex: 1,
  },

  saveButton: {
    height: 50,
    marginTop: 20,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  cancelEditButton: {
    height: 44,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelEditButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },

  editDividerBig: {
    height: 1,
    backgroundColor: '#EEF1F4',
    marginTop: 8,
  },
});


