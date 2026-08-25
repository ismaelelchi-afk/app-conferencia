// ============================================================
// CADASTRAR / EDITAR PRODUTO — RAMSONS CONFERÊNCIA
// Modo criar: sem params → gera codigoInterno automático.
// Modo editar: recebe ?codigoInterno=XXX → pré-carrega campos.
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
  atualizarProduto,
  buscarPorCodigoInterno,
  criarProdutoManual,
  removerProduto,
  validarCodigoBarrasCond,
} from '@/database/database';
import type { Produto } from '@/models/produto';

// ============================================================
// TELA
// ============================================================

export default function CadastrarProdutoScreen() {
  const { codigoInterno: codigoParam } = useLocalSearchParams<{
    codigoInterno?: string;
  }>();

  const modoEdicao = !!codigoParam;

  // ----------------------------------------------------------
  // CAMPOS
  // ----------------------------------------------------------

  const [codigoInterno, setCodigoInterno] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [modelo, setModelo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [esArAcondicionado, setEsArAcondicionado] = useState(false);
  const [codigoBarrasCond, setCodigoBarrasCond] = useState('');

  // ----------------------------------------------------------
  // ESTADO DA TELA
  // ----------------------------------------------------------

  const [produtoOriginal, setProdutoOriginal] = useState<Produto | null>(null);
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const nomeValido = nome.trim().length >= 3;

  // ----------------------------------------------------------
  // CARREGAR PRODUTO (modo edição)
  // ----------------------------------------------------------

  useEffect(() => {
    if (!codigoParam) return;

    buscarPorCodigoInterno(codigoParam)
      .then((produto) => {
        if (!produto) {
          setErro('Produto não encontrado.');
          return;
        }

        setProdutoOriginal(produto);
        setCodigoInterno(produto.codigoInterno);
        setCodigoBarras(produto.codigoBarras ?? '');
        setNome(produto.nome);
        setMarca(produto.marca ?? '');
        setCategoria(produto.categoria ?? '');
        setModelo(produto.modelo ?? '');
        setDescricao(produto.descricao ?? '');
        setEsArAcondicionado(produto.esArAcondicionado ?? false);
        setCodigoBarrasCond(produto.codigoBarrasCond ?? '');
      })
      .catch(() => setErro('Erro ao carregar produto.'))
      .finally(() => setCarregando(false));
  }, [codigoParam]);

  // ----------------------------------------------------------
  // SALVAR
  // ----------------------------------------------------------

  async function salvar() {
    if (!nomeValido || salvando) return;

    setSalvando(true);
    setErro(null);

    try {
      const condTrimmed = codigoBarrasCond.trim();

      if (esArAcondicionado && condTrimmed) {
        const erroValidacao = await validarCodigoBarrasCond(
          condTrimmed,
          modoEdicao && produtoOriginal
            ? produtoOriginal.codigoInterno
            : '__novo__',
        );
        if (erroValidacao) {
          setErro(erroValidacao);
          setSalvando(false);
          return;
        }
      }

      if (modoEdicao && produtoOriginal) {
        const produtoAtualizado: Produto = {
          ...produtoOriginal,
          codigoInterno: codigoInterno.trim() || produtoOriginal.codigoInterno,
          nome: nome.trim(),
          marca: marca.trim() || undefined,
          categoria: categoria.trim() || undefined,
          modelo: modelo.trim() || undefined,
          descricao: descricao.trim() || undefined,
          esArAcondicionado,
          codigoBarrasCond: esArAcondicionado && condTrimmed ? condTrimmed : undefined,
        };

        await atualizarProduto(produtoAtualizado, codigoParam!);
      } else {
        await criarProdutoManual({
          codigoInterno: codigoInterno.trim() || undefined,
          codigoBarras: codigoBarras.trim() || null,
          nome: nome.trim(),
          marca: marca.trim() || undefined,
          categoria: categoria.trim() || undefined,
          modelo: modelo.trim() || undefined,
          descricao: descricao.trim() || undefined,
          esArAcondicionado,
          codigoBarrasCond: esArAcondicionado && condTrimmed ? condTrimmed : null,
        });
      }

      setSucesso(true);
      setTimeout(() => router.back(), 1000);
    } catch {
      setErro(
        modoEdicao
          ? 'Não foi possível salvar as alterações.'
          : 'Não foi possível cadastrar. Verifique se o código já não está em uso.',
      );
    } finally {
      setSalvando(false);
    }
  }

  // ----------------------------------------------------------
  // EXCLUIR
  // ----------------------------------------------------------

  async function excluir() {
    if (!codigoParam || excluindo) return;

    setExcluindo(true);
    setErro(null);

    try {
      await removerProduto(codigoParam);
      router.back();
    } catch {
      setErro('Não foi possível excluir o produto.');
      setExcluindo(false);
      setConfirmarExclusao(false);
    }
  }

  // ----------------------------------------------------------
  // INTERFACE — carregando
  // ----------------------------------------------------------

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // INTERFACE — confirmação de exclusão
  // ----------------------------------------------------------

  if (confirmarExclusao) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => setConfirmarExclusao(false)}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Text style={styles.headerTitle}>EXCLUIR PRODUTO</Text>
            <View style={styles.headerSpace} />
          </View>

          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Confirmar exclusão</Text>
            <Text style={styles.confirmNome}>{nome}</Text>
            {codigoInterno ? (
              <Text style={styles.confirmCodigo}>{codigoInterno}</Text>
            ) : null}
            <Text style={styles.confirmAviso}>
              O produto será desativado e não aparecerá mais nas conferências.
              Esta ação pode ser revertida pelo administrador.
            </Text>

            {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

            <Pressable
              style={styles.deleteConfirmButton}
              onPress={() => { void excluir(); }}
              disabled={excluindo}
            >
              {excluindo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteConfirmButtonText}>
                  SIM, EXCLUIR PRODUTO
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setConfirmarExclusao(false)}
              disabled={excluindo}
            >
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // INTERFACE — formulário principal
  // ----------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {modoEdicao ? 'EDITAR PRODUTO' : 'CADASTRAR PRODUTO'}
          </Text>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {sucesso && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {modoEdicao
                  ? '✓ Alterações salvas!'
                  : '✓ Produto cadastrado com sucesso!'}
              </Text>
            </View>
          )}

          {/* CÓDIGO DE BARRAS — imutável após criação */}
          <Text style={styles.label}>
            CÓDIGO DE BARRAS{modoEdicao ? ' (não pode ser alterado)' : ''}
          </Text>
          <TextInput
            style={[styles.input, modoEdicao && styles.inputReadonly]}
            value={codigoBarras}
            onChangeText={modoEdicao ? undefined : setCodigoBarras}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
            editable={!modoEdicao && !salvando && !sucesso}
          />

          {/* CÓDIGO INTERNO — editável em qualquer modo */}
          <Text style={styles.label}>
            CÓDIGO INTERNO{modoEdicao ? '' : ' (opcional — gerado automaticamente)'}
          </Text>
          <TextInput
            style={styles.input}
            value={codigoInterno}
            onChangeText={setCodigoInterno}
            placeholder={modoEdicao ? '' : 'Ex.: MAN-001 (deixe em branco para gerar)'}
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
            autoCapitalize="characters"
          />

          {/* NOME */}
          <Text style={styles.label}>NOME *</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do produto (mínimo 3 caracteres)"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* MARCA */}
          <Text style={styles.label}>MARCA</Text>
          <TextInput
            style={styles.input}
            value={marca}
            onChangeText={setMarca}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* CATEGORIA */}
          <Text style={styles.label}>CATEGORIA</Text>
          <TextInput
            style={styles.input}
            value={categoria}
            onChangeText={setCategoria}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* MODELO */}
          <Text style={styles.label}>MODELO</Text>
          <TextInput
            style={styles.input}
            value={modelo}
            onChangeText={setModelo}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* DESCRIÇÃO */}
          <Text style={styles.label}>DESCRIÇÃO</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={3}
            editable={!salvando && !sucesso}
          />

          {/* AR CONDICIONADO */}
          <Text style={styles.label}>TIPO</Text>
          <Pressable
            style={styles.toggleRow}
            onPress={() => setEsArAcondicionado(!esArAcondicionado)}
            disabled={salvando || sucesso}
          >
            <View
              style={[
                styles.checkbox,
                esArAcondicionado && styles.checkboxAtivo,
              ]}
            >
              {esArAcondicionado && (
                <Text style={styles.checkboxCheck}>✓</Text>
              )}
            </View>
            <Text style={styles.toggleLabel}>É ar condicionado (VAP + COND)</Text>
          </Pressable>

          {esArAcondicionado && (
            <>
              <View style={styles.acInfoBox}>
                <Text style={styles.acInfoTitle}>❄ Conjunto VAP + COND</Text>
                <Text style={styles.acInfoText}>
                  O código de barras principal é a VAP (Evaporadora).{'\n'}
                  Cadastre abaixo o código da COND (Condensadora) quando disponível.
                </Text>
              </View>

              <Text style={styles.label}>CÓDIGO DE BARRAS COND (Condensadora)</Text>
              <TextInput
                style={styles.input}
                value={codigoBarrasCond}
                onChangeText={setCodigoBarrasCond}
                placeholder="Opcional — cadastrar depois se necessário"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                editable={!salvando && !sucesso}
              />
            </>
          )}

          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

          {/* BOTÃO SALVAR */}
          <Pressable
            style={[
              styles.saveButton,
              (!nomeValido || salvando || sucesso) && styles.saveButtonDisabled,
            ]}
            onPress={() => { void salvar(); }}
            disabled={!nomeValido || salvando || sucesso}
          >
            {salvando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {modoEdicao ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR PRODUTO'}
              </Text>
            )}
          </Pressable>

          {/* BOTÃO EXCLUIR (só no modo edição) */}
          {modoEdicao && !sucesso && (
            <Pressable
              style={styles.deleteButton}
              onPress={() => setConfirmarExclusao(true)}
              disabled={salvando}
            >
              <Text style={styles.deleteButtonText}>EXCLUIR PRODUTO</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  scrollContent: {
    paddingTop: 8,
    paddingBottom: 36,
  },

  successBox: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#ECFDF3',
    marginBottom: 16,
  },

  successText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#12B76A',
    textAlign: 'center',
  },

  label: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  input: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#18212F',
  },

  inputReadonly: {
    backgroundColor: '#F5F7FA',
    color: '#667085',
  },

  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  errorText: {
    marginTop: 16,
    fontSize: 13,
    color: '#D92D20',
    textAlign: 'center',
  },

  saveButton: {
    height: 56,
    marginTop: 26,
    borderRadius: 15,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  deleteButton: {
    height: 52,
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D92D20',
  },

  // Confirmação de exclusão
  confirmBox: {
    flex: 1,
    paddingTop: 24,
  },

  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18212F',
    marginBottom: 16,
  },

  confirmNome: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18212F',
  },

  confirmCodigo: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
    marginBottom: 16,
  },

  confirmAviso: {
    fontSize: 14,
    color: '#667085',
    lineHeight: 20,
    marginBottom: 24,
  },

  deleteConfirmButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  deleteConfirmButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  cancelButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E1E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667085',
  },

  toggleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    backgroundColor: '#FFFFFF',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D0D5DD',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxAtivo: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },

  checkboxCheck: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18212F',
    flex: 1,
  },

  acInfoBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EFF8FF',
    borderWidth: 1,
    borderColor: '#B2DDFF',
  },

  acInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#175CD3',
    marginBottom: 6,
  },

  acInfoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#344054',
  },
});
