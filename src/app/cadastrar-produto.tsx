// ============================================================
// CADASTRAR PRODUTO — RAMSONS CONFERÊNCIA
// Formulário completo para cadastrar um produto do zero.
// ============================================================

import { router } from 'expo-router';
import { useState } from 'react';
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

import { criarProdutoManual } from '@/database/database';

// ============================================================
// TELA
// ============================================================

export default function CadastrarProdutoScreen() {
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [modelo, setModelo] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [estoque, setEstoque] = useState('0');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const nomeValido = nome.trim().length >= 3;

  // ==========================================================
  // SALVAR
  // ==========================================================

  async function salvar() {
    if (!nomeValido || salvando) {
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await criarProdutoManual({
        codigoBarras: codigoBarras.trim() || null,
        nome: nome.trim(),
        marca: marca.trim() || undefined,
        categoria: categoria.trim() || undefined,
        modelo: modelo.trim() || undefined,
        unidade: unidade.trim() || 'UN',
        estoque: Number(estoque) || 0,
      });

      setSucesso(true);

      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
      setErro(
        'Não foi possível cadastrar o produto. Verifique se o código de barras já não está em uso.',
      );
    } finally {
      setSalvando(false);
    }
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
            CADASTRAR PRODUTO
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
                ✓ Produto cadastrado com sucesso!
              </Text>
            </View>
          )}

          <Text style={styles.label}>NOME *</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do produto"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          <Text style={styles.label}>CÓDIGO DE BARRAS</Text>
          <TextInput
            style={styles.input}
            value={codigoBarras}
            onChangeText={setCodigoBarras}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
            editable={!salvando && !sucesso}
          />

          <Text style={styles.label}>MARCA</Text>
          <TextInput
            style={styles.input}
            value={marca}
            onChangeText={setMarca}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          <Text style={styles.label}>CATEGORIA</Text>
          <TextInput
            style={styles.input}
            value={categoria}
            onChangeText={setCategoria}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          <Text style={styles.label}>MODELO</Text>
          <TextInput
            style={styles.input}
            value={modelo}
            onChangeText={setModelo}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>UNIDADE</Text>
              <TextInput
                style={styles.input}
                value={unidade}
                onChangeText={setUnidade}
                placeholder="UN"
                placeholderTextColor="#98A2B3"
                autoCapitalize="characters"
                editable={!salvando && !sucesso}
              />
            </View>

            <View style={styles.rowItem}>
              <Text style={styles.label}>ESTOQUE</Text>
              <TextInput
                style={styles.input}
                value={estoque}
                onChangeText={setEstoque}
                placeholder="0"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                editable={!salvando && !sucesso}
              />
            </View>
          </View>

          {erro && <Text style={styles.errorText}>{erro}</Text>}

          <Pressable
            style={[
              styles.saveButton,
              (!nomeValido || salvando || sucesso) &&
                styles.saveButtonDisabled,
            ]}
            onPress={() => {
              void salvar();
            }}
            disabled={!nomeValido || salvando || sucesso}
          >
            {salvando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                CADASTRAR PRODUTO
              </Text>
            )}
          </Pressable>
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
    paddingBottom: 30,
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

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  rowItem: {
    flex: 1,
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
});


