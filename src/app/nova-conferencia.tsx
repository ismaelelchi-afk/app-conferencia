// ============================================================
// NOVA CONFERÊNCIA — RAMSONS CONFERÊNCIA
// ============================================================

import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { criarConferencia } from '@/database/database';

// ============================================================
// TELA PARA INICIAR UMA NOVA CONFERÊNCIA
// ============================================================

export default function NovaConferenciaScreen() {
  // Nome digitado pelo usuário (opcional).
  const [nome, setNome] = useState('');

  // Indica se a conferência está sendo criada.
  const [criando, setCriando] = useState(false);

  // Guarda um possível erro ao criar a conferência.
  const [erro, setErro] = useState<string | null>(null);

  // ==========================================================
  // INICIAR LEITURA
  // Cria a conferência no SQLite somente agora, ao confirmar.
  // ==========================================================

  async function iniciarLeitura() {
    if (criando) {
      return;
    }

    setCriando(true);
    setErro(null);

    try {
      const conferencia = await criarConferencia(nome);

      router.replace({
        pathname: '/leitura',
        params: { conferenciaId: String(conferencia.id) },
      });
    } catch (error) {
      console.error('Erro ao criar conferência:', error);
      setErro('Não foi possível criar a conferência.');
    } finally {
      setCriando(false);
    }
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

          <Text style={styles.headerTitle}>
            NOVA CONFERÊNCIA
          </Text>

          <View style={styles.headerSpace} />
        </View>

        {/* Introdução */}
        <View style={styles.introduction}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📦</Text>
          </View>

          <Text style={styles.title}>
            NOVA CONFERÊNCIA
          </Text>

          <Text style={styles.description}>
            Dê um nome para identificar esta{'\n'}
            conferência, ou deixe em branco.
          </Text>
        </View>

        {/* Campo de nome */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>
            NOME DA CONFERÊNCIA
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ex: Recepção Samsung"
            placeholderTextColor="#98A2B3"
            value={nome}
            onChangeText={setNome}
            maxLength={60}
            editable={!criando}
          />

          <Text style={styles.inputHint}>
            Se deixar em branco, será usado um{'\n'}
            número automático como nome.
          </Text>
        </View>

        {erro && (
          <Text style={styles.errorText}>
            {erro}
          </Text>
        )}

        {/* Início da leitura */}
        <Pressable
          style={[
            styles.startButton,
            criando && styles.startButtonDisabled,
          ]}
          onPress={() => {
            void iniciarLeitura();
          }}
          disabled={criando}
        >
          {criando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.startIcon}>📷</Text>

              <Text style={styles.startText}>
                INICIAR LEITURA
              </Text>
            </>
          )}
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

// Estilos da tela
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
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

  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#18212F',
  },

  headerSpace: {
    width: 44,
  },

  // Introdução
  introduction: {
    alignItems: 'center',
    marginTop: 25,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },

  icon: {
    fontSize: 40,
  },

  title: {
    marginTop: 18,
    fontSize: 21,
    fontWeight: '800',
    color: '#18212F',
  },

  description: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
  },

  // Campo de nome
  inputCard: {
    marginTop: 28,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  input: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#18212F',
  },

  inputHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: '#98A2B3',
  },

  errorText: {
    marginTop: 14,
    fontSize: 13,
    color: '#D92D20',
    textAlign: 'center',
  },

  // Botão principal
  startButton: {
    height: 64,
    marginTop: 26,
    borderRadius: 16,
    backgroundColor: '#208AEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },

  startButtonDisabled: {
    opacity: 0.7,
  },

  startIcon: {
    fontSize: 24,
    marginRight: 12,
  },

  startText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
