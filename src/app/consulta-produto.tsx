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

import { formatarCodigoInterno, obterProdutos } from '@/database/database';
import type { Produto } from '@/models/produto';

export default function ConsultaProdutoScreen() {
  const [todos, setTodos] = useState<Produto[]>([]);
  const [termo, setTermo] = useState('');
  const [termoCat, setTermoCat] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      obterProdutos()
        .then((lista) => { if (ativo) setTodos(lista); })
        .catch((e) => { console.error('Erro ao carregar produtos:', e); })
        .finally(() => { if (ativo) setCarregando(false); });

      return () => { ativo = false; };
    }, []),
  );

  // Contagem por categoria (ignorando filtro de texto para que os números sejam estáveis)
  const contagemPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of todos) {
      if (p.categoria) {
        mapa[p.categoria] = (mapa[p.categoria] ?? 0) + 1;
      }
    }
    return mapa;
  }, [todos]);

  // Categorias ordenadas por quantidade (maior primeiro), filtradas pelo termoCat
  const categorias = useMemo(() => {
    const tc = termoCat.trim().toLowerCase();
    return Object.keys(contagemPorCategoria)
      .filter((c) => !tc || c.toLowerCase().includes(tc))
      .sort((a, b) => (contagemPorCategoria[b] ?? 0) - (contagemPorCategoria[a] ?? 0));
  }, [contagemPorCategoria, termoCat]);

  const resultados = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return todos.filter((p) => {
      if (categoriaAtiva && p.categoria !== categoriaAtiva) return false;
      if (!t) return true;
      return (
        p.nome.toLowerCase().includes(t) ||
        p.codigoInterno.toLowerCase().includes(t) ||
        (p.codigoBarras && p.codigoBarras.includes(t)) ||
        (p.marca && p.marca.toLowerCase().includes(t))
      );
    });
  }, [termo, categoriaAtiva, todos]);

  const hayFiltro = !!categoriaAtiva || termo.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>PROCURAR PRODUTOS</Text>
            {!carregando && (
              <Text style={styles.headerCount}>
                {hayFiltro
                  ? `${resultados.length} de ${todos.length} produto(s)`
                  : `${todos.length} produto(s)`}
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
            placeholder="Nome, código, marca..."
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

        {/* Filtros de categoría */}
        {!carregando && Object.keys(contagemPorCategoria).length > 0 && (
          <View style={styles.filtrosWrapper}>
            {/* Buscador de categoría */}
            <View style={styles.catSearchBox}>
              <Text style={styles.catSearchIcon}>🔍</Text>
              <TextInput
                style={styles.catSearchInput}
                placeholder="Buscar categoría..."
                placeholderTextColor="#98A2B3"
                value={termoCat}
                onChangeText={setTermoCat}
                autoCapitalize="none"
              />
              {termoCat.length > 0 && (
                <Pressable onPress={() => setTermoCat('')} style={styles.clearButton}>
                  <Text style={styles.clearIcon}>✕</Text>
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtrosScroll}
              contentContainerStyle={styles.filtrosContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Pill "Todas" */}
              <Pressable
                style={[styles.pill, categoriaAtiva === null && styles.pillAtiva]}
                onPress={() => setCategoriaAtiva(null)}
              >
                <Text style={[styles.pillLabel, categoriaAtiva === null && styles.pillLabelAtiva]}>
                  Todas
                </Text>
                <View style={[styles.pillBadge, categoriaAtiva === null && styles.pillBadgeAtiva]}>
                  <Text style={[styles.pillBadgeText, categoriaAtiva === null && styles.pillBadgeTextAtiva]}>
                    {todos.length}
                  </Text>
                </View>
              </Pressable>

              {categorias.map((cat) => {
                const ativa = categoriaAtiva === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.pill, ativa && styles.pillAtiva]}
                    onPress={() => setCategoriaAtiva(ativa ? null : cat)}
                  >
                    <Text style={[styles.pillLabel, ativa && styles.pillLabelAtiva]} numberOfLines={1}>
                      {cat}
                    </Text>
                    <View style={[styles.pillBadge, ativa && styles.pillBadgeAtiva]}>
                      <Text style={[styles.pillBadgeText, ativa && styles.pillBadgeTextAtiva]}>
                        {contagemPorCategoria[cat] ?? 0}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Banner de filtro activo */}
            {categoriaAtiva && (
              <Pressable style={styles.filtroAtivoBanner} onPress={() => setCategoriaAtiva(null)}>
                <Text style={styles.filtroAtivoTexto}>
                  Filtrando: <Text style={styles.filtroAtivoNome}>{categoriaAtiva}</Text>
                </Text>
                <Text style={styles.filtroAtivoFechar}>✕ limpar</Text>
              </Pressable>
            )}
          </View>
        )}

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
              {hayFiltro
                ? 'Nenhum produto encontrado para esse filtro.'
                : 'Nenhum produto cadastrado.'}
            </Text>
            {hayFiltro && (
              <Pressable
                style={styles.limparFiltroBtn}
                onPress={() => { setTermo(''); setCategoriaAtiva(null); }}
              >
                <Text style={styles.limparFiltroBtnText}>LIMPAR FILTROS</Text>
              </Pressable>
            )}
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
                onPress={() =>
                  router.push(`/cadastrar-produto?codigoInterno=${encodeURIComponent(item.codigoInterno)}`)
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardCode}>{formatarCodigoInterno(item.codigoInterno)}</Text>
                  <View style={[
                    styles.origemBadge,
                    item.origem === 'manual' && styles.origemManual,
                    item.origem === 'desconhecido' && styles.origemDesconhecido,
                  ]}>
                    <Text style={styles.origemBadgeText}>
                      {item.origem === 'catalogo' ? 'CATÁLOGO' : item.origem === 'manual' ? 'MANUAL' : 'NÃO IDENT.'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardName} numberOfLines={2}>{item.nome}</Text>

                {item.especificacoes_resumo ? (
                  <Text style={styles.cardEspec} numberOfLines={1}>{item.especificacoes_resumo}</Text>
                ) : null}

                <View style={styles.cardMeta}>
                  {item.marca && <Text style={styles.cardBrand}>{item.marca}</Text>}
                  {item.categoria && <Text style={styles.cardCategory}>{item.categoria}</Text>}
                </View>

                <Text style={styles.cardBarcode}>
                  {item.codigoBarras || 'sem código de barras'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { flex: 1, paddingHorizontal: 20 },

  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 38, lineHeight: 42, color: '#18212F' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#18212F' },
  headerCount: { marginTop: 1, fontSize: 11, color: '#667085' },
  headerSpace: { width: 44 },

  searchBox: {
    height: 50,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#18212F' },
  clearButton: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center',
  },
  clearIcon: { fontSize: 11, color: '#667085' },

  filtrosWrapper: { marginBottom: 8, gap: 6 },

  catSearchBox: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catSearchIcon: { fontSize: 13 },
  catSearchInput: { flex: 1, fontSize: 13, color: '#18212F' },

  filtrosScroll: { flexGrow: 0 },

  filtrosContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    paddingRight: 4,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  pillAtiva: { backgroundColor: '#208AEF', borderColor: '#208AEF' },

  pillLabel: { fontSize: 13, fontWeight: '700', color: '#344054', maxWidth: 140 },
  pillLabelAtiva: { color: '#FFFFFF' },

  pillBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  pillBadgeAtiva: { backgroundColor: 'rgba(255,255,255,0.25)' },

  pillBadgeText: { fontSize: 11, fontWeight: '800', color: '#667085' },
  pillBadgeTextAtiva: { color: '#FFFFFF' },

  filtroAtivoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#B2D6FB',
    marginTop: 2,
  },
  filtroAtivoTexto: { fontSize: 12, color: '#175CD3' },
  filtroAtivoNome: { fontWeight: '800' },
  filtroAtivoFechar: { fontSize: 12, fontWeight: '700', color: '#175CD3' },

  centerContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30,
  },
  loadingText: { marginTop: 12, fontSize: 13, color: '#667085' },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 13, lineHeight: 19, color: '#667085', textAlign: 'center' },

  limparFiltroBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#208AEF',
  },
  limparFiltroBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  list: { paddingTop: 4, paddingBottom: 20, gap: 8 },

  card: {
    padding: 14, borderRadius: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  cardCode: { fontSize: 12, fontWeight: '800', color: '#208AEF' },
  origemBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#EAF4FF' },
  origemManual: { backgroundColor: '#FFFBEA' },
  origemDesconhecido: { backgroundColor: '#FFF1F0' },
  origemBadgeText: { fontSize: 8, fontWeight: '900', color: '#667085' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#18212F' },
  cardEspec: { marginTop: 2, fontSize: 11, color: '#667085', fontStyle: 'italic' },
  cardMeta: { marginTop: 4, flexDirection: 'row', gap: 8 },
  cardBrand: { fontSize: 11, color: '#667085' },
  cardCategory: { fontSize: 11, color: '#98A2B3' },
  cardBarcode: { marginTop: 3, fontSize: 11, color: '#98A2B3' },
});
