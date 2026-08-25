// ============================================================
// GERENCIAR PRODUTOS — RAMSONS CONFERÊNCIA
// Parte 1/2 — Lista e lógica
// Mostra produtos manuais e não identificados (origem !=
// 'catalogo'), permitindo completar ou editar cada um.
// ============================================================

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
  atualizarProduto,
  completarProdutoDesconhecido,
  listarProdutosNaoCatalogo,
  removerProduto,
} from '@/database/database';
import type { DadosProdutoRapido, Produto } from '@/models/produto';

// ============================================================
// TELA
// ============================================================

export default function GerenciarProdutosScreen() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);

  // ==========================================================
  // CARREGAR TODA VEZ QUE A TELA GANHA FOCO
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregar() {
        try {
          const lista = await listarProdutosNaoCatalogo();

          if (ativo) {
            setProdutos(lista);
          }
        } catch (error) {
          console.error('Erro ao listar produtos:', error);
        } finally {
          if (ativo) {
            setCarregando(false);
          }
        }
      }

      carregar();

      return () => {
        ativo = false;
      };
    }, []),
  );

  // ==========================================================
  // APÓS SALVAR: atualiza o item na lista, sem recarregar tudo
  // ==========================================================

  function handleAtualizado(produtoAtualizado: Produto) {
    setProdutos((lista) =>
      lista.map((item) =>
        item.codigoInterno === produtoAtualizado.codigoInterno
          ? produtoAtualizado
          : item,
      ),
    );

    setProdutoSelecionado(null);
  }

  // ==========================================================
  // APÓS REMOVER: tira o item da lista
  // ==========================================================

  function handleRemovido(codigoInterno: string) {
    setProdutos((lista) =>
      lista.filter((item) => item.codigoInterno !== codigoInterno),
    );

    setProdutoSelecionado(null);
  }

  // ==========================================================
  // INTERFACE
  // ==========================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>GERENCIAR PRODUTOS</Text>

          <View style={styles.headerSpace} />
        </View>

        {carregando ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : produtos.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>✅</Text>

            <Text style={styles.emptyTitle}>
              Nenhum produto pendente
            </Text>

            <Text style={styles.emptyText}>
              Produtos manuais ou não identificados
              durante uma conferência vão aparecer aqui.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {produtos.map((produto) => {
              const ehDesconhecido = produto.origem === 'desconhecido';

              return (
                <Pressable
                  key={produto.codigoInterno}
                  style={[
                    styles.card,
                    ehDesconhecido
                      ? styles.cardDesconhecido
                      : styles.cardManual,
                  ]}
                  onPress={() => setProdutoSelecionado(produto)}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName} numberOfLines={2}>
                      {produto.nome}
                    </Text>

                    <View
                      style={[
                        styles.badge,
                        ehDesconhecido
                          ? styles.badgeDesconhecido
                          : styles.badgeManual,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {ehDesconhecido ? 'REVISAR' : 'MANUAL'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardCode}>
                    {produto.codigoInterno}
                  </Text>

                  <Text style={styles.cardBarcode}>
                    {produto.codigoBarras || 'sem código de barras'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {produtoSelecionado && (
        <ModalGerenciarProduto
          produto={produtoSelecionado}
          onFechar={() => setProdutoSelecionado(null)}
          onAtualizado={handleAtualizado}
          onRemovido={handleRemovido}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// PARTE 2/2 — Modal de edição/completar + estilos
// ============================================================

type ModalGerenciarProdutoProps = {
  produto: Produto;
  onFechar: () => void;
  onAtualizado: (produto: Produto) => void;
  onRemovido: (codigoInterno: string) => void;
};

function ModalGerenciarProduto({
  produto,
  onFechar,
  onAtualizado,
  onRemovido,
}: ModalGerenciarProdutoProps) {
  const ehDesconhecido = produto.origem === 'desconhecido';

  const [codigoInterno, setCodigoInterno] = useState(produto.codigoInterno);
  const [nome, setNome] = useState(
    ehDesconhecido ? '' : produto.nome,
  );
  const [marca, setMarca] = useState(produto.marca ?? '');
  const [categoria, setCategoria] = useState(produto.categoria ?? '');
  const [modelo, setModelo] = useState(produto.modelo ?? '');
  const [descricao, setDescricao] = useState(produto.descricao ?? '');

  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeValido = nome.trim().length >= 3;

  // ==========================================================
  // SALVAR
  // Se era desconhecido, completa (vira manual).
  // Se já era manual, apenas atualiza os campos.
  // ==========================================================

  async function salvar() {
    if (!nomeValido || salvando) {
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      if (ehDesconhecido) {
        const dados: DadosProdutoRapido = {
          codigoInterno: codigoInterno.trim() || undefined,
          nome: nome.trim(),
          marca: marca.trim() || undefined,
          categoria: categoria.trim() || undefined,
          modelo: modelo.trim() || undefined,
          descricao: descricao.trim() || undefined,
        };

        const novoCodigoInterno = await completarProdutoDesconhecido(
          produto.codigoInterno,
          dados,
        );

        onAtualizado({
          ...produto,
          codigoInterno: novoCodigoInterno,
          nome: dados.nome,
          marca: dados.marca,
          categoria: dados.categoria,
          modelo: dados.modelo,
          descricao: dados.descricao,
          origem: 'manual',
        });
      } else {
        const produtoAtualizado: Produto = {
          ...produto,
          codigoInterno: codigoInterno.trim() || produto.codigoInterno,
          nome: nome.trim(),
          marca: marca.trim() || undefined,
          categoria: categoria.trim() || undefined,
          modelo: modelo.trim() || undefined,
          descricao: descricao.trim() || undefined,
        };

        const sucesso = await atualizarProduto(produtoAtualizado, produto.codigoInterno);

        if (!sucesso) {
          setErro('Não foi possível salvar: produto não encontrado.');
          return;
        }

        onAtualizado(produtoAtualizado);
      }
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      setErro(
        'Não foi possível salvar. Verifique se o código de barras já não está em uso.',
      );
    } finally {
      setSalvando(false);
    }
  }

  // ==========================================================
  // REMOVER (desativa o produto)
  // ==========================================================

  async function remover() {
    if (removendo) {
      return;
    }

    setRemovendo(true);
    setErro(null);

    try {
      await removerProduto(produto.codigoInterno);
      onRemovido(produto.codigoInterno);
    } catch (error) {
      console.error('Erro ao remover produto:', error);
      setErro('Não foi possível remover o produto.');
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.editCard}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Código de barras — imutável */}
          <View style={styles.barcodeBox}>
            <Text style={styles.barcodeLabel}>CÓDIGO DE BARRAS</Text>
            <Text selectable style={styles.barcodeValue}>
              {produto.codigoBarras || 'sem código de barras'}
            </Text>
          </View>

          <Text style={styles.editTitle}>
            {ehDesconhecido
              ? 'COMPLETAR PRODUTO'
              : 'EDITAR PRODUTO MANUAL'}
          </Text>

          {erro && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{erro}</Text>
            </View>
          )}

          <Text style={styles.editLabel}>CÓDIGO INTERNO</Text>
          <TextInput
            style={styles.editInput}
            value={codigoInterno}
            onChangeText={setCodigoInterno}
            placeholder="Código interno"
            placeholderTextColor="#98A2B3"
            autoCapitalize="characters"
            editable={!salvando && !removendo}
          />

          <Text style={styles.editLabel}>NOME *</Text>
          <TextInput
            style={styles.editInput}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do produto"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !removendo}
          />

          <Text style={styles.editLabel}>MARCA</Text>
          <TextInput
            style={styles.editInput}
            value={marca}
            onChangeText={setMarca}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !removendo}
          />

          <Text style={styles.editLabel}>CATEGORIA</Text>
          <TextInput
            style={styles.editInput}
            value={categoria}
            onChangeText={setCategoria}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !removendo}
          />

          <Text style={styles.editLabel}>MODELO</Text>
          <TextInput
            style={styles.editInput}
            value={modelo}
            onChangeText={setModelo}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !removendo}
          />

          <Text style={styles.editLabel}>DESCRIÇÃO</Text>
          <TextInput
            style={[styles.editInput, styles.editInputMultiline]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={3}
            editable={!salvando && !removendo}
          />

          <Pressable
            style={[
              styles.saveButton,
              (!nomeValido || salvando || removendo) &&
                styles.buttonDisabled,
            ]}
            onPress={() => {
              void salvar();
            }}
            disabled={!nomeValido || salvando || removendo}
          >
            {salvando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                SALVAR
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.editFullButton, (salvando || removendo) && styles.buttonDisabled]}
            onPress={() => {
              onFechar();
              router.push(
                `/cadastrar-produto?codigoInterno=${encodeURIComponent(produto.codigoInterno)}`,
              );
            }}
            disabled={salvando || removendo}
          >
            <Text style={styles.editFullButtonText}>EDITAR COMPLETO</Text>
          </Pressable>

          <Pressable
            style={[
              styles.removeButton,
              (salvando || removendo) && styles.buttonDisabled,
            ]}
            onPress={() => {
              void remover();
            }}
            disabled={salvando || removendo}
          >
            {removendo ? (
              <ActivityIndicator size="small" color="#F04438" />
            ) : (
              <Text style={styles.removeButtonText}>
                REMOVER PRODUTO
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={onFechar}
            disabled={salvando || removendo}
          >
            <Text style={styles.cancelButtonText}>CANCELAR</Text>
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
    fontSize: 14,
    fontWeight: '800',
    color: '#18212F',
    textAlign: 'center',
  },

  headerSpace: {
    width: 44,
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#18212F',
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 8,
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
    borderWidth: 1.5,
  },

  cardManual: {
    backgroundColor: '#FFFBEA',
    borderColor: '#F2C94C',
  },

  cardDesconhecido: {
    backgroundColor: '#FFF1F0',
    borderColor: '#F04438',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  cardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#18212F',
    marginRight: 8,
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  badgeManual: {
    backgroundColor: '#F2C94C',
  },

  badgeDesconhecido: {
    backgroundColor: '#F04438',
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  cardCode: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#208AEF',
  },

  cardBarcode: {
    marginTop: 2,
    fontSize: 11,
    color: '#667085',
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  editCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  barcodeBox: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
    marginBottom: 4,
    alignItems: 'center',
  },

  barcodeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#98A2B3',
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  barcodeValue: {
    fontSize: 13,
    color: '#475467',
    fontWeight: '600',
  },

  editInputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  editTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  errorBox: {
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF1F0',
  },

  errorBoxText: {
    fontSize: 12,
    color: '#B42318',
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

  editFullButton: {
    height: 48,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editFullButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#208AEF',
  },

  removeButton: {
    height: 48,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F04438',
  },

  cancelButton: {
    height: 46,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },
});


