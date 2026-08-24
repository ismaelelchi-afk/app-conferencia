// ============================================================
// HISTÓRICO — RAMSONS CONFERÊNCIA
// Lista todas as conferências finalizadas.
// Ao tocar em uma, abre o resultado em modo somente leitura.
// ============================================================

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listarHistorico } from '@/database/database';
import type { ConferenciaComContagem } from '@/database/database';

// ============================================================
// FORMATAR DATA E HORA
// ============================================================

function formatarDataHora(dataIso?: string): string {
  if (!dataIso) {
    return '—';
  }

  const data = new Date(dataIso);

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');

  return `${dia}/${mes} às ${horas}:${minutos}`;
}

// ============================================================
// TELA
// ============================================================

export default function HistoricoScreen() {
  const [conferencias, setConferencias] =
    useState<ConferenciaComContagem[]>([]);

  const [carregando, setCarregando] = useState(true);

  // ==========================================================
  // RECARREGAR TODA VEZ QUE A TELA GANHA FOCO
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregar() {
        try {
          const lista = await listarHistorico();

          if (ativo) {
            setConferencias(lista);
          }
        } catch (error) {
          console.error('Erro ao listar histórico:', error);
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
  // ABRIR RESULTADO (somente leitura)
  // ==========================================================

  function abrirResultado(conferenciaId: number) {
    router.push({
      pathname: '/resultado',
      params: { conferenciaId: String(conferenciaId) },
    });
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
            HISTÓRICO
          </Text>

          <View style={styles.headerSpace} />
        </View>

        {carregando ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : conferencias.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>🗂️</Text>

            <Text style={styles.emptyTitle}>
              Nenhuma conferência finalizada
            </Text>

            <Text style={styles.emptyText}>
              As conferências que você finalizar
              vão aparecer aqui.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {conferencias.map((conferencia) => (
              <Pressable
                key={conferencia.id}
                style={styles.card}
                onPress={() => abrirResultado(conferencia.id)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {conferencia.nome}
                  </Text>

                  <View
                    style={[
                      styles.statusBadge,
                      conferencia.status === 'cancelada' &&
                        styles.statusBadgeCancelada,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        conferencia.status === 'cancelada' &&
                          styles.statusBadgeTextCancelada,
                      ]}
                    >
                      {conferencia.status === 'cancelada'
                        ? 'CANCELADA'
                        : 'FINALIZADA'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDate}>
                  {conferencia.status === 'cancelada'
                    ? 'Cancelada em '
                    : 'Finalizada em '}
                  {formatarDataHora(conferencia.dataFim)}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardCount}>
                    {conferencia.produtosLidos}{' '}
                    {conferencia.produtosLidos === 1
                      ? 'produto lido'
                      : 'produtos lidos'}
                  </Text>

                  <Text style={styles.cardAction}>VER RESULTADO ›</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
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
    gap: 10,
  },

  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    elevation: 1,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#18212F',
    marginRight: 8,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#ECFDF3',
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#12B76A',
  },

  cardDate: {
    marginTop: 4,
    fontSize: 12,
    color: '#667085',
  },

  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#208AEF',
  },

  cardAction: {
    fontSize: 12,
    fontWeight: '800',
    color: '#18212F',
  },

  statusBadgeCancelada: {
    backgroundColor: '#FFF1F0',
  },

  statusBadgeTextCancelada: {
    color: '#F04438',
  },
});
