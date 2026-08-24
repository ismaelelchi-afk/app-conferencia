// ============================================================
// LAYOUT PRINCIPAL — RAMSONS CONFERÊNCIA
// ============================================================

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  importarProdutosRamsons,
  inicializarDatabase,
} from '@/database/database';

// ============================================================
// PANTALLA DE CARGA
// ============================================================

function TelaCarregando() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingTitle}>
        RAMSONS
      </Text>

      <Text style={styles.loadingSubtitle}>
        CONFERÊNCIA
      </Text>

      <ActivityIndicator
        size="large"
        style={styles.loadingIndicator}
      />

      <Text style={styles.loadingText}>
        Preparando banco de dados...
      </Text>
    </View>
  );
}

// ============================================================
// LAYOUT PRINCIPAL
// ============================================================

export default function RootLayout() {
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  // ==========================================================
  // INICIALIZAR SQLITE
  // ==========================================================

  useEffect(() => {
    let ativo = true;

    async function prepararDatabase() {
      try {
        await inicializarDatabase();
        await importarProdutosRamsons();

        if (ativo) {
          setDatabaseReady(true);
        }
      } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error);

        if (ativo) {
          setDatabaseError(
            'Não foi possível inicializar o banco de dados.',
          );
        }
      }
    }

    prepararDatabase();

    return () => {
      ativo = false;
    };
  }, []);

  // ==========================================================
  // ERROR
  // ==========================================================

  if (databaseError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Erro ao iniciar</Text>
        <Text style={styles.errorText}>{databaseError}</Text>
      </View>
    );
  }

  // ==========================================================
  // CARGANDO
  // ==========================================================

  if (!databaseReady) {
    return <TelaCarregando />;
  }

  // ==========================================================
  // NAVEGAÇÃO
  // ==========================================================

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Início' }} />

      <Stack.Screen
        name="nova-conferencia"
        options={{ title: 'Nova Conferência' }}
      />

      <Stack.Screen
        name="conferencias-em-andamento"
        options={{ title: 'Em Andamento' }}
      />

      <Stack.Screen
        name="leitura"
        options={{ title: 'Leitura' }}
      />

      <Stack.Screen
        name="resultado"
        options={{ title: 'Resultado' }}
      />

      <Stack.Screen
        name="historico"
        options={{ title: 'Histórico' }}
      />

      <Stack.Screen
        name="consulta-produto"
        options={{ title: 'Consultar Produto' }}
      />

      <Stack.Screen
        name="cadastrar-produto"
        options={{ title: 'Cadastrar Produto' }}
      />

      <Stack.Screen
        name="configuracoes"
        options={{ title: 'Configurações' }}
      />

      <Stack.Screen
        name="gerenciar-produtos"
        options={{ title: 'Gerenciar Produtos' }}
      />
    </Stack>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#18212F',
  },

  loadingSubtitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#208AEF',
  },

  loadingIndicator: {
    marginTop: 28,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
  },

  errorContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  errorIcon: {
    fontSize: 42,
    marginBottom: 14,
  },

  errorTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
    textAlign: 'center',
  },
});

