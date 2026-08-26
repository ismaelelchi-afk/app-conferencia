// ============================================================
// TELA INICIAL — RAMSONS CONFERÊNCIA
// ============================================================

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Tela inicial da aplicação
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Identidade da aplicação */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>📦</Text>
          </View>

          <Text style={styles.brand}>RAMSONS</Text>
          <Text style={styles.title}>CONFERÊNCIA</Text>

          <Text style={styles.description}>
            Conferência de produtos e logística
          </Text>
        </View>

        {/* Ação principal */}
        <View style={styles.mainActions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/nova-conferencia')}
          >
            <Text style={styles.primaryIcon}>📷</Text>
            <Text style={styles.primaryText}>
              NOVA CONFERÊNCIA
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/conferencias-em-andamento')}
          >
            <Text style={styles.secondaryIcon}>⏳</Text>
            <Text style={styles.secondaryText}>
              CONFERÊNCIAS EM ANDAMENTO
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/historico')}
          >
            <Text style={styles.secondaryIcon}>📋</Text>
            <Text style={styles.secondaryText}>
              HISTÓRICO
            </Text>
          </Pressable>
        </View>

        {/* Funções secundárias */}
        <View style={styles.menu}>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/consulta-produto')}
          >
            <Text style={styles.menuIcon}>🔎</Text>
            <Text style={styles.menuText}>
              Procurar produto
            </Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/cadastrar-produto')}
          >
            <Text style={styles.menuIcon}>➕</Text>
            <Text style={styles.menuText}>
              Cadastrar produto
            </Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/configuracoes')}
          >
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>
              Configurações
            </Text>
          </Pressable>
        </View>

        {/* Versão da aplicação */}
        <Text style={styles.version}>
          RAMSONS Conferência • v1.0.0
        </Text>

      </View>
    </SafeAreaView>
  );
}

// Estilos da tela inicial
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  // Cabeçalho
  header: {
    alignItems: 'center',
    marginTop: 20,
  },

  logo: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 4,
  },

  logoIcon: {
    fontSize: 40,
  },

  brand: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#18212F',
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#208AEF',
    marginTop: 2,
  },

  description: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    marginTop: 10,
  },

  // Botões principais
  mainActions: {
    marginTop: 30,
    gap: 10,
  },

  primaryButton: {
    height: 62,
    borderRadius: 16,
    backgroundColor: '#208AEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },

  primaryIcon: {
    fontSize: 22,
    marginRight: 12,
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  secondaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryIcon: {
    fontSize: 19,
    marginRight: 10,
  },

  secondaryText: {
    color: '#18212F',
    fontSize: 14,
    fontWeight: '700',
  },

  // Menu secundário
  menu: {
    marginTop: 22,
    gap: 4,
  },

  menuItem: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  menuIcon: {
    fontSize: 21,
    width: 40,
  },

  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#344054',
  },

  // Rodapé
  version: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 12,
    color: '#98A2B3',
  },
});


