import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  obterProdutos,
  removerProduto,
} from '@/database/database';
import type { Produto } from '@/models/produto';

export default function ConsultaProdutoScreen() {
  const [todos, setTodos] = useState<Produto[]>([]);
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);

  // Recarrega sempre que a tela entra em foco (ex: ao voltar da edição).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      obterProdutos()
        .then((lista) => {
          if (ativo) setTodos(lista);
        })
        .catch((error) => {
          console.error('Erro ao carregar produtos:', error);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });

      return () => {
        ativo = false;
      };
    }, []),
  );

  // Filtra client-side sem delay — lista já está em memória.
  const resultados = useMemo(() => {
    const t = termo.trim().toLowerCase();

    if (!t) {
      return todos;
    }

    return todos.filter(
      (p) =>
        p.nome.toLowerCase().includes(t) ||
        p.codigoInterno.toLowerCase().includes(t) ||
        (p.codigoBarras && p.codigoBarras.includes(t)) ||
        (p.marca && p.marca.toLowerCase().includes(t)),
    );
  }, [termo, todos]);

  function handleProdutoRemovido(codigoInterno: string) {
    setTodos((lista) =>
      lista.filter((item) => item.codigoInterno !== codigoInterno),
    );
    setProdutoSelecionado(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>PRODUTOS</Text>
            {!carregando && (
              <Text style={styles.headerCount}>
                {resultados.length === todos.length
                  ? `${todos.length} produto(s)`
                  : `${resultados.length} de ${todos.length}`}
              </Text>
            )}
          </View>

          <View style={styles.headerSpace} />
        </View>

        {/* Buscador */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Nome, código interno, código de barras ou marca"
            placeholderTextColor="#98A2B3"
            value={termo}
            onChangeText={setTermo}
            autoCapitalize="none"
          />

          {termo.length > 0 && (
            <Pressable onPress={() => setTermo('')} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Lista */}
        {carregando ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Carregando produtos...</Text>
          </View>
        ) : resultados.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              {termo.trim()
                ? `Nenhum produto encontrado para "${termo.trim()}".`
                : 'Nenhum produto cadastrado.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={resultados}
            keyExtractor={(item) => item.codigoInterno}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => setProdutoSelecionado(item)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardCode}>{item.codigoInterno}</Text>

                  <View
                    style={[
                      styles.origemBadge,
                      item.origem === 'manual' && styles.origemManual,
                      item.origem === 'desconhecido' && styles.origemDesconhecido,
                    ]}
                  >
                    <Text style={styles.origemBadgeText}>
                      {item.origem === 'catalogo'
                        ? 'CATÁLOGO'
                        : item.origem === 'manual'
                        ? 'MANUAL'
                        : 'NÃO IDENT.'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardName} numberOfLines={2}>
                  {item.nome}
                </Text>

                <View style={styles.cardMeta}>
                  {item.marca && (
                    <Text style={styles.cardBrand}>{item.marca}</Text>
                  )}
                  {item.categoria && (
                    <Text style={styles.cardCategory}>{item.categoria}</Text>
                  )}
                </View>

                <Text style={styles.cardBarcode}>
                  {item.codigoBarras || 'sem código de barras'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      {produtoSelecionado && (
        <DetalheProdutoModal
          produto={produtoSelecionado}
          onFechar={() => setProdutoSelecionado(null)}
          onProdutoRemovido={handleProdutoRemovido}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// MODAL DE DETALHE / EDIÇÃO / EXCLUSÃO
// ============================================================

type DetalheProdutoModalProps = {
  produto: Produto;
  onFechar: () => void;
  onProdutoRemovido: (codigoInterno: string) => void;
};

function DetalheProdutoModal({
  produto,
  onFechar,
  onProdutoRemovido,
}: DetalheProdutoModalProps) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);


  async function confirmarExclusao() {
    if (excluindo) return;

    setExcluindo(true);

    try {
      await removerProduto(produto.codigoInterno);
      onProdutoRemovido(produto.codigoInterno);
    } catch {
      setErro('Não foi possível remover o produto.');
      setConfirmandoExclusao(false);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>
            {confirmandoExclusao ? 'EXCLUIR PRODUTO' : 'DETALHES DO PRODUTO'}
          </Text>

          <Pressable onPress={onFechar} style={styles.detailCloseButton}>
            <Text style={styles.detailCloseIcon}>✕</Text>
          </Pressable>
        </View>

        {confirmandoExclusao ? (
          <View style={styles.confirmExclusao}>
            <Text style={styles.confirmExclusaoIcon}>⚠️</Text>
            <Text style={styles.confirmExclusaoTitulo}>
              Excluir este produto?
            </Text>
            <Text style={styles.confirmExclusaoNome}>{produto.nome}</Text>
            <Text style={styles.confirmExclusaoAviso}>
              O produto será desativado. Leituras em conferências existentes
              não serão afetadas.
            </Text>

            {erro ? <Text style={styles.errorBoxText}>{erro}</Text> : null}

            <Pressable
              style={[styles.dangerButton, excluindo && styles.buttonDisabled]}
              onPress={() => void confirmarExclusao()}
              disabled={excluindo}
            >
              {excluindo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.dangerButtonText}>SIM, EXCLUIR</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelEditButton}
              onPress={() => setConfirmandoExclusao(false)}
              disabled={excluindo}
            >
              <Text style={styles.cancelEditButtonText}>CANCELAR</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.detailName}>{produto.nome}</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Código interno</Text>
              <Text style={styles.detailValue}>{produto.codigoInterno}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Código de barras</Text>
              <Text selectable style={styles.detailValue}>
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
                <Text style={styles.detailValue}>{produto.categoria}</Text>
              </View>
            )}

            {produto.modelo && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Modelo</Text>
                <Text style={styles.detailValue}>{produto.modelo}</Text>
              </View>
            )}

            {produto.descricao && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Descrição</Text>
                <Text style={styles.detailValue}>{produto.descricao}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Origem</Text>
              <Text style={styles.detailValue}>
                {produto.origem === 'catalogo'
                  ? 'Catálogo RAMSONS'
                  : produto.origem === 'manual'
                  ? 'Cadastrado manualmente'
                  : 'Não identificado'}
              </Text>
            </View>

            {/* Editar — navega ao formulário completo */}
            <Pressable
              style={styles.editButton}
              onPress={() => {
                onFechar();
                router.push(
                  `/cadastrar-produto?codigoInterno=${encodeURIComponent(produto.codigoInterno)}`,
                );
              }}
            >
              <Text style={styles.editButtonText}>✏️  EDITAR PRODUTO</Text>
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() => {
                setErro(null);
                setConfirmandoExclusao(true);
              }}
            >
              <Text style={styles.deleteButtonText}>🗑️  EXCLUIR PRODUTO</Text>
            </Pressable>
          </ScrollView>
        )}
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

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18212F',
  },

  headerCount: {
    marginTop: 1,
    fontSize: 11,
    color: '#667085',
  },

  headerSpace: {
    width: 44,
  },

  searchBox: {
    height: 50,
    marginBottom: 8,
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

  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearIcon: {
    fontSize: 11,
    color: '#667085',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#667085',
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
    paddingTop: 4,
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

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  cardCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#208AEF',
  },

  origemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EAF4FF',
  },

  origemManual: {
    backgroundColor: '#FFFBEA',
  },

  origemDesconhecido: {
    backgroundColor: '#FFF1F0',
  },

  origemBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#667085',
  },

  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18212F',
  },

  cardMeta: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },

  cardBrand: {
    fontSize: 11,
    color: '#667085',
  },

  cardCategory: {
    fontSize: 11,
    color: '#98A2B3',
  },

  cardBarcode: {
    marginTop: 3,
    fontSize: 11,
    color: '#98A2B3',
  },

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
    maxHeight: '90%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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

  deleteButton: {
    height: 48,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F04438',
  },

  // Confirmação de exclusão
  confirmExclusao: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  confirmExclusaoIcon: {
    fontSize: 36,
    marginBottom: 10,
  },

  confirmExclusaoTitulo: {
    fontSize: 16,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  confirmExclusaoNome: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
    textAlign: 'center',
  },

  confirmExclusaoAviso: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#98A2B3',
    textAlign: 'center',
  },

  dangerButton: {
    width: '100%',
    height: 50,
    marginTop: 20,
    borderRadius: 13,
    backgroundColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dangerButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  errorBoxText: {
    marginTop: 10,
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
  },

  buttonDisabled: {
    opacity: 0.5,
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
});
