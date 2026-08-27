// ============================================================
// CONFERÊNCIAS EM ANDAMENTO — RAMSONS CONFERÊNCIA
// ============================================================

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  atualizarNomeConferencia,
  eliminarConferencias,
  listarConferenciasPorStatus,
} from '@/database/database';
import type { ConferenciaComContagem } from '@/database/database';

function formatarDataHora(dataIso: string): string {
  const data = new Date(dataIso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} às ${horas}:${minutos}`;
}

export default function ConferenciasEmAndamentoScreen() {
  const [conferencias, setConferencias] = useState<ConferenciaComContagem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [conferenciaRenomeando, setConferenciaRenomeando] = useState<ConferenciaComContagem | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      async function carregar() {
        try {
          const lista = await listarConferenciasPorStatus('em_andamento');
          if (ativo) setConferencias(lista);
        } catch (error) {
          console.error('Erro ao listar conferências:', error);
        } finally {
          if (ativo) setCarregando(false);
        }
      }
      carregar();
      return () => { ativo = false; };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (confirmandoExclusao) { setConfirmandoExclusao(false); return true; }
        if (conferenciaRenomeando) { setConferenciaRenomeando(null); return true; }
        if (modoSelecao) { sairModoSelecao(); return true; }
        return false;
      });
      return () => sub.remove();
    }, [confirmandoExclusao, conferenciaRenomeando, modoSelecao]),
  );

  function sairModoSelecao() {
    setModoSelecao(false);
    setSelecionados(new Set());
  }

  function entrarModoSelecao(id: number) {
    setModoSelecao(true);
    setSelecionados(new Set([id]));
  }

  function toggleSelecao(id: number) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selecionarTodos() {
    setSelecionados(new Set(conferencias.map((c) => c.id)));
  }

  async function confirmarExclusao() {
    if (excluindo) return;
    setExcluindo(true);
    try {
      await eliminarConferencias([...selecionados]);
      setConferencias((prev) => prev.filter((c) => !selecionados.has(c.id)));
      sairModoSelecao();
      setConfirmandoExclusao(false);
    } catch (error) {
      console.error('Erro ao eliminar conferências:', error);
    } finally {
      setExcluindo(false);
    }
  }

  function abrirRenomear(conferencia: ConferenciaComContagem) {
    setConferenciaRenomeando(conferencia);
    setNovoNome(conferencia.nome);
  }

  async function salvarNome() {
    if (!conferenciaRenomeando || salvandoNome) return;
    setSalvandoNome(true);
    try {
      await atualizarNomeConferencia(conferenciaRenomeando.id, novoNome);
      const nomeFinal = novoNome.trim() || conferenciaRenomeando.numero;
      setConferencias((lista) =>
        lista.map((item) =>
          item.id === conferenciaRenomeando.id ? { ...item, nome: nomeFinal } : item,
        ),
      );
      setConferenciaRenomeando(null);
    } catch (error) {
      console.error('Erro ao renomear conferência:', error);
    } finally {
      setSalvandoNome(false);
    }
  }

  function continuar(conferenciaId: number) {
    router.push({ pathname: '/leitura', params: { conferenciaId: String(conferenciaId) } });
  }

  const qtdSelecionados = selecionados.size;
  const todosSeleccionados = qtdSelecionados === conferencias.length && conferencias.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          {modoSelecao ? (
            <>
              <Pressable style={styles.backButton} onPress={sairModoSelecao}>
                <Text style={styles.backIcon}>✕</Text>
              </Pressable>
              <Text style={styles.headerTitle}>
                {qtdSelecionados} selecionada{qtdSelecionados !== 1 ? 's' : ''}
              </Text>
              <View style={styles.headerActions}>
                <Pressable onPress={todosSeleccionados ? sairModoSelecao : selecionarTodos} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>{todosSeleccionados ? 'Nenhuma' : 'Todas'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmandoExclusao(true)}
                  style={[styles.headerBtn, styles.headerBtnDel]}
                  disabled={qtdSelecionados === 0}
                >
                  <Text style={styles.headerBtnDelText}>🗑 Excluir</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>CONFERÊNCIAS EM ANDAMENTO</Text>
              <View style={styles.headerSpace} />
            </>
          )}
        </View>

        {carregando ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : conferencias.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Nenhuma conferência em andamento</Text>
            <Text style={styles.emptyText}>
              Inicie uma nova conferência para começar a escanear produtos.
            </Text>
            <Pressable style={styles.newButton} onPress={() => router.push('/nova-conferencia')}>
              <Text style={styles.newButtonText}>NOVA CONFERÊNCIA</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {conferencias.map((conferencia) => {
              const selecionado = selecionados.has(conferencia.id);
              return (
                <View
                  key={conferencia.id}
                  style={[styles.card, selecionado && styles.cardSelecionado]}
                >
                  {/* Checkbox em modo seleção */}
                  {modoSelecao && (
                    <Pressable
                      style={styles.checkboxArea}
                      onPress={() => toggleSelecao(conferencia.id)}
                    >
                      <View style={[styles.checkbox, selecionado && styles.checkboxAtivo]}>
                        {selecionado && <Text style={styles.checkboxMarca}>✓</Text>}
                      </View>
                    </Pressable>
                  )}

                  {/* Corpo da tarjeta — toque abre/seleciona */}
                  <Pressable
                    style={styles.cardBody}
                    onPress={() => {
                      if (modoSelecao) { toggleSelecao(conferencia.id); return; }
                      continuar(conferencia.id);
                    }}
                    onLongPress={() => { if (!modoSelecao) entrarModoSelecao(conferencia.id); }}
                  >
                    <View style={styles.cardTop}>
                      <Pressable
                        onPress={() => { if (!modoSelecao) abrirRenomear(conferencia); }}
                        style={styles.cardNamePress}
                      >
                        <Text style={styles.cardName} numberOfLines={1}>
                          {conferencia.nome}
                        </Text>
                      </Pressable>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>EM PROCESSO</Text>
                      </View>
                    </View>

                    <Text style={styles.cardDate}>
                      Iniciada em {formatarDataHora(conferencia.dataInicio)}
                    </Text>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardCount}>
                        {conferencia.produtosLidos}{' '}
                        {conferencia.produtosLidos === 1 ? 'produto lido' : 'produtos lidos'}
                      </Text>
                      {!modoSelecao && <Text style={styles.cardAction}>CONTINUAR ›</Text>}
                    </View>
                  </Pressable>

                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Modal renomear */}
      {conferenciaRenomeando && (
        <View style={styles.overlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameIcon}>✏️</Text>
            <Text style={styles.renameTitle}>RENOMEAR CONFERÊNCIA</Text>
            <TextInput
              style={styles.renameInput}
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome da conferência"
              placeholderTextColor="#98A2B3"
              maxLength={60}
              editable={!salvandoNome}
              autoFocus
            />
            <Pressable
              style={styles.renameSaveButton}
              onPress={() => { void salvarNome(); }}
              disabled={salvandoNome}
            >
              {salvandoNome
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.renameSaveButtonText}>SALVAR</Text>}
            </Pressable>
            <Pressable
              style={styles.renameCancelButton}
              onPress={() => setConferenciaRenomeando(null)}
              disabled={salvandoNome}
            >
              <Text style={styles.renameCancelButtonText}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Modal confirmação exclusão */}
      {confirmandoExclusao && (
        <View style={styles.overlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameIcon}>🗑️</Text>
            <Text style={styles.renameTitle}>EXCLUIR CONFERÊNCIAS?</Text>
            <Text style={styles.confirmText}>
              {qtdSelecionados === 1
                ? 'A conferência selecionada será excluída permanentemente.'
                : `As ${qtdSelecionados} conferências selecionadas serão excluídas permanentemente.`}
            </Text>
            <Pressable
              style={[styles.confirmDelBtn, excluindo && { opacity: 0.6 }]}
              onPress={() => { void confirmarExclusao(); }}
              disabled={excluindo}
            >
              {excluindo
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.confirmDelBtnText}>SIM, EXCLUIR</Text>}
            </Pressable>
            <Pressable
              style={styles.renameCancelButton}
              onPress={() => setConfirmandoExclusao(false)}
              disabled={excluindo}
            >
              <Text style={styles.renameCancelButtonText}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      )}
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

  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#18212F',
    textAlign: 'center',
  },

  headerSpace: { width: 44 },

  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },

  headerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F2F4F7' },

  headerBtnText: { fontSize: 12, fontWeight: '700', color: '#344054' },

  headerBtnDel: { backgroundColor: '#FFF1F0' },

  headerBtnDelText: { fontSize: 12, fontWeight: '700', color: '#F04438' },

  centerContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30,
  },

  emptyIcon: { fontSize: 42, marginBottom: 12 },

  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#18212F', textAlign: 'center' },

  emptyText: { marginTop: 8, fontSize: 13, lineHeight: 19, color: '#667085', textAlign: 'center' },

  newButton: {
    marginTop: 24, height: 52, paddingHorizontal: 30,
    borderRadius: 13, backgroundColor: '#208AEF',
    alignItems: 'center', justifyContent: 'center',
  },

  newButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  list: { paddingTop: 12, paddingBottom: 20, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    elevation: 1,
    overflow: 'hidden',
  },

  cardSelecionado: { borderColor: '#208AEF', backgroundColor: '#F0F8FF' },

  checkboxArea: { paddingHorizontal: 14, paddingVertical: 16, alignSelf: 'stretch', justifyContent: 'center' },

  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#D0D5DD',
    alignItems: 'center', justifyContent: 'center',
  },

  checkboxAtivo: { backgroundColor: '#208AEF', borderColor: '#208AEF' },

  checkboxMarca: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },

  cardBody: { flex: 1, padding: 16 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  cardNamePress: { flex: 1, marginRight: 8 },

  cardName: { fontSize: 16, fontWeight: '800', color: '#18212F' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FFFBEA' },

  statusBadgeText: { fontSize: 9, fontWeight: '900', color: '#9A7B00' },

  cardDate: { marginTop: 4, fontSize: 12, color: '#667085' },

  cardFooter: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  cardCount: { fontSize: 13, fontWeight: '700', color: '#208AEF' },

  cardAction: { fontSize: 12, fontWeight: '800', color: '#18212F' },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  renameCard: {
    width: '100%', maxWidth: 420, padding: 24,
    borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center',
  },

  renameIcon: { fontSize: 30, marginBottom: 8 },

  renameTitle: { fontSize: 17, fontWeight: '900', color: '#18212F', textAlign: 'center' },

  confirmText: {
    marginTop: 10, fontSize: 14, lineHeight: 20,
    color: '#475467', textAlign: 'center',
  },

  renameInput: {
    width: '100%', marginTop: 18, height: 48,
    borderRadius: 12, borderWidth: 1, borderColor: '#E1E5EA',
    paddingHorizontal: 14, fontSize: 15, color: '#18212F',
  },

  renameSaveButton: {
    width: '100%', minHeight: 50, marginTop: 18,
    borderRadius: 13, backgroundColor: '#208AEF',
    alignItems: 'center', justifyContent: 'center',
  },

  renameSaveButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  renameCancelButton: {
    width: '100%', minHeight: 44, marginTop: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  renameCancelButtonText: { fontSize: 13, fontWeight: '700', color: '#667085' },

  confirmDelBtn: {
    width: '100%', minHeight: 50, marginTop: 18,
    borderRadius: 13, backgroundColor: '#F04438',
    alignItems: 'center', justifyContent: 'center',
  },

  confirmDelBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
