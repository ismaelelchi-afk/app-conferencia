// ============================================================
// CONFERÊNCIAS EM ANDAMENTO — RAMSONS CONFERÊNCIA
// Lista todas as conferências ainda não finalizadas,
// permitindo continuar de onde parou.
// ============================================================

import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listarConferenciasPorStatus } from '@/database/database';
import { atualizarNomeConferencia } from '@/database/database';
import type { ConferenciaComContagem } from '@/database/database';

// ============================================================
// FORMATAR DATA E HORA
// ============================================================

function formatarDataHora(dataIso: string): string {
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

export default function ConferenciasEmAndamentoScreen() {
  const [conferencias, setConferencias] =
    useState<ConferenciaComContagem[]>([]);

  const [carregando, setCarregando] = useState(true);

  const [conferenciaRenomeando, setConferenciaRenomeando] =
    useState<ConferenciaComContagem | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  // ==========================================================
  // RECARREGAR TODA VEZ QUE A TELA GANHA FOCO
  // (importante: pode voltar aqui depois de continuar uma
  // conferência e escanear mais produtos)
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregar() {
        try {
          const lista = await listarConferenciasPorStatus('em_andamento');

          if (ativo) {
            setConferencias(lista);
          }
        } catch (error) {
          console.error('Erro ao listar conferências:', error);
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
  // CONTINUAR CONFERÊNCIA
  // ==========================================================

  function abrirRenomear(conferencia: ConferenciaComContagem) {
    setConferenciaRenomeando(conferencia);
    setNovoNome(conferencia.nome);
  }

  function fecharRenomear() {
    setConferenciaRenomeando(null);
  }

  async function salvarNome() {
    if (!conferenciaRenomeando || salvandoNome) {
      return;
    }

    setSalvandoNome(true);

    try {
      await atualizarNomeConferencia(
        conferenciaRenomeando.id,
        novoNome,
      );

      const nomeFinal =
        novoNome.trim() || conferenciaRenomeando.numero;

      setConferencias((lista) =>
        lista.map((item) =>
          item.id === conferenciaRenomeando.id
            ? { ...item, nome: nomeFinal }
            : item,
        ),
      );

      fecharRenomear();
    } catch (error) {
      console.error('Erro ao renomear conferência:', error);
    } finally {
      setSalvandoNome(false);
    }
  }

  function continuar(conferenciaId: number) {
    router.push({
      pathname: '/leitura',
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
            CONFERÊNCIAS EM ANDAMENTO
          </Text>

          <View style={styles.headerSpace} />
        </View>

        {carregando ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : conferencias.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📭</Text>

            <Text style={styles.emptyTitle}>
              Nenhuma conferência em andamento
            </Text>

            <Text style={styles.emptyText}>
              Inicie uma nova conferência para
              começar a escanear produtos.
            </Text>

            <Pressable
              style={styles.newButton}
              onPress={() => router.push('/nova-conferencia')}
            >
              <Text style={styles.newButtonText}>
                NOVA CONFERÊNCIA
              </Text>
            </Pressable>
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
                onPress={() => continuar(conferencia.id)}
              >
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>
            {conferencia.nome}
          </Text>

          <Pressable
            style={styles.editIconButton}
            onPress={() => abrirRenomear(conferencia)}
          >
            <Text style={styles.editIcon}>✏️</Text>
          </Pressable>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              EM PROCESSO
            </Text>
          </View>
        </View>

                <Text style={styles.cardDate}>
                  Iniciada em {formatarDataHora(conferencia.dataInicio)}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardCount}>
                    {conferencia.produtosLidos}{' '}
                    {conferencia.produtosLidos === 1
                      ? 'produto lido'
                      : 'produtos lidos'}
                  </Text>

                  <Text style={styles.cardAction}>CONTINUAR ›</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {conferenciaRenomeando && (
        <View style={styles.overlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameIcon}>✏️</Text>

            <Text style={styles.renameTitle}>
              RENOMEAR CONFERÊNCIA
            </Text>

            <TextInput
              style={styles.renameInput}
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome da conferência"
              placeholderTextColor="#98A2B3"
              maxLength={60}
              editable={!salvandoNome}
            />

            <Pressable
              style={styles.renameSaveButton}
              onPress={() => {
                void salvarNome();
              }}
              disabled={salvandoNome}
            >
              {salvandoNome ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.renameSaveButtonText}>
                  SALVAR
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.renameCancelButton}
              onPress={fecharRenomear}
              disabled={salvandoNome}
            >
              <Text style={styles.renameCancelButtonText}>
                CANCELAR
              </Text>
            </Pressable>
          </View>
        </View>
      )}
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

  newButton: {
    marginTop: 24,
    height: 52,
    paddingHorizontal: 30,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: '#FFFBEA',
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#9A7B00',
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

  editIconButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  editIcon: {
    fontSize: 15,
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  renameCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },

  renameIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  renameTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  renameInput: {
    width: '100%',
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#18212F',
  },

  renameSaveButton: {
    width: '100%',
    minHeight: 50,
    marginTop: 18,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  renameSaveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  renameCancelButton: {
    width: '100%',
    minHeight: 44,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  renameCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },
});


