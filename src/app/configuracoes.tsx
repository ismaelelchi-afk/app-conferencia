import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apagarHistoricoFinalizado,
  contarProdutos,
  contarProdutosPorOrigem,
  importarCatalogoExterno,
  obterConfiguracao,
  obterDadosExportacaoHistorico,
  resetarBancoDeDados,
  salvarConfiguracao,
} from '@/database/database';

const VELOCIDADE_PADRAO_MS = 2500;

export default function ConfiguracoesScreen() {
  const [carregando, setCarregando] = useState(true);

  const [velocidadeTexto, setVelocidadeTexto] = useState(
    String(VELOCIDADE_PADRAO_MS),
  );
  const [modoLeitura, setModoLeitura] = useState<'automatico' | 'manual'>(
    'automatico',
  );
  const [somAtivado, setSomAtivado] = useState(true);
  const [vibrarAtivado, setVibrarAtivado] = useState(true);
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [catalogoAtualizadoEm, setCatalogoAtualizadoEm] = useState<
    string | null
  >(null);
  const [produtosParaRevisar, setProdutosParaRevisar] = useState(0);

  const [reimportando, setReimportando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [resetando, setResetando] = useState(false);

  const [mostrarConfirmacaoApagar, setMostrarConfirmacaoApagar] =
    useState(false);
  const [mostrarConfirmacaoResetar, setMostrarConfirmacaoResetar] =
    useState(false);

  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const [
          velocidade,
          modo,
          som,
          vibrar,
          dataAtualizacao,
          contagem,
          total,
        ] = await Promise.all([
          obterConfiguracao('tempo_bloqueio_ms', String(VELOCIDADE_PADRAO_MS)),
          obterConfiguracao('modo_leitura', 'automatico'),
          obterConfiguracao('som_ativado', 'true'),
          obterConfiguracao('vibrar_ativado', 'true'),
          obterConfiguracao('catalogo_atualizado_em', ''),
          contarProdutosPorOrigem(),
          contarProdutos(),
        ]);

        if (ativo) {
          setVelocidadeTexto(velocidade);

          if (modo === 'automatico' || modo === 'manual') {
            setModoLeitura(modo);
          }

          setSomAtivado(som !== 'false');
          setVibrarAtivado(vibrar !== 'false');
          setCatalogoAtualizadoEm(dataAtualizacao || null);
          setProdutosParaRevisar(contagem.manual + contagem.desconhecido);
          setTotalProdutos(total);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
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
  }, []);

  function alterarVelocidade(texto: string) {
    const somenteNumeros = texto.replace(/[^0-9]/g, '');
    setVelocidadeTexto(somenteNumeros);

    const numero = Number(somenteNumeros);

    if (somenteNumeros.trim() !== '' && numero > 0) {
      salvarConfiguracao('tempo_bloqueio_ms', String(numero)).catch(
        (error) => {
          console.error('Erro ao salvar velocidade de leitura:', error);
        },
      );
    }
  }

  function alterarModoLeitura(modo: 'automatico' | 'manual') {
    setModoLeitura(modo);

    salvarConfiguracao('modo_leitura', modo).catch((error) => {
      console.error('Erro ao salvar modo de leitura:', error);
    });
  }

  function alterarSom(valor: boolean) {
    setSomAtivado(valor);

    salvarConfiguracao('som_ativado', String(valor)).catch((error) => {
      console.error('Erro ao salvar configuração de som:', error);
    });
  }

  function alterarVibracao(valor: boolean) {
    setVibrarAtivado(valor);

    salvarConfiguracao('vibrar_ativado', String(valor)).catch((error) => {
      console.error('Erro ao salvar configuração de vibração:', error);
    });
  }

  async function importarCatalogoDoDispositivo() {
    if (reimportando) return;

    setMensagem(null);

    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (resultado.canceled || !resultado.assets?.length) {
        return;
      }

      const arquivo = resultado.assets[0];

      setReimportando(true);

      const conteudo = await FileSystem.readAsStringAsync(arquivo.uri);
      const total = await importarCatalogoExterno(conteudo);

      const [novaData, novoTotal] = await Promise.all([
        obterConfiguracao('catalogo_atualizado_em', ''),
        contarProdutos(),
      ]);

      setCatalogoAtualizadoEm(novaData || null);
      setTotalProdutos(novoTotal);
      setMensagem(`Catálogo importado: ${total} produtos.`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Erro ao importar catálogo.';
      setMensagem(msg);
    } finally {
      setReimportando(false);
    }
  }

  async function exportarHistorico() {
    if (exportando) {
      return;
    }

    setExportando(true);
    setMensagem(null);

    try {
      const dados = await obterDadosExportacaoHistorico();

      if (dados.length === 0) {
        setMensagem('Não há conferências finalizadas para exportar.');
        return;
      }

      const linhas: string[] = [];
      linhas.push('RAMSONS CONFERÊNCIA — HISTÓRICO EXPORTADO');
      linhas.push('');

      for (const { conferencia, leituras } of dados) {
        linhas.push(`Conferência: ${conferencia.nome}`);
        linhas.push(`Finalizada em: ${conferencia.dataFim ?? '—'}`);
        linhas.push(`Produtos: ${leituras.length}`);
        linhas.push('---');

        for (const item of leituras) {
          linhas.push(
            `${item.produto.codigoInterno} | ${item.produto.nome} | Qtd: ${item.quantidade}`,
          );
        }

        linhas.push('');
      }

      await Share.share({
        message: linhas.join('\n'),
        title: 'Histórico de conferências RAMSONS',
      });
    } catch (error) {
      console.error('Erro ao exportar histórico:', error);
      setMensagem('Não foi possível exportar o histórico.');
    } finally {
      setExportando(false);
    }
  }

  async function confirmarApagarHistorico() {
    if (apagando) {
      return;
    }

    setApagando(true);
    setMensagem(null);

    try {
      const total = await apagarHistoricoFinalizado();
      setMensagem(`${total} conferência(s) apagada(s) do histórico.`);
      setMostrarConfirmacaoApagar(false);
    } catch (error) {
      console.error('Erro ao apagar histórico:', error);
      setMensagem('Não foi possível apagar o histórico.');
    } finally {
      setApagando(false);
    }
  }

  async function confirmarResetarBanco() {
    if (resetando) {
      return;
    }

    setResetando(true);
    setMensagem(null);

    try {
      const total = await resetarBancoDeDados();
      setMensagem(
        `Banco de dados resetado. ${total} produtos do catálogo restaurados.`,
      );
      setMostrarConfirmacaoResetar(false);

      const [contagem, novoTotal, novaData] = await Promise.all([
        contarProdutosPorOrigem(),
        contarProdutos(),
        obterConfiguracao('catalogo_atualizado_em', ''),
      ]);

      setProdutosParaRevisar(contagem.manual + contagem.desconhecido);
      setTotalProdutos(novoTotal);
      setCatalogoAtualizadoEm(novaData || null);
    } catch (error) {
      console.error('Erro ao resetar banco de dados:', error);
      setMensagem('Não foi possível resetar o banco de dados.');
    } finally {
      setResetando(false);
    }
  }

  function formatarData(iso: string | null): string {
    if (!iso) {
      return 'Desconhecida';
    }

    const d = new Date(iso);

    if (isNaN(d.getTime())) {
      return 'Desconhecida';
    }

    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const versaoApp = Constants.expoConfig?.version ?? '—';

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

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

          <Text style={styles.headerTitle}>CONFIGURAÇÕES</Text>

          <View style={styles.headerSpace} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {mensagem && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{mensagem}</Text>
            </View>
          )}

          {/* LEITURA */}
          <Text style={styles.sectionTitle}>📷  LEITURA</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>MODO DE LEITURA</Text>

            <View style={styles.modoLeituraRow}>
              <Pressable
                style={[
                  styles.modoLeituraButton,
                  modoLeitura === 'automatico' &&
                    styles.modoLeituraButtonAtivo,
                ]}
                onPress={() => alterarModoLeitura('automatico')}
              >
                <Text
                  style={[
                    styles.modoLeituraButtonText,
                    modoLeitura === 'automatico' &&
                      styles.modoLeituraButtonTextAtivo,
                  ]}
                >
                  AUTOMÁTICA
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modoLeituraButton,
                  modoLeitura === 'manual' && styles.modoLeituraButtonAtivo,
                ]}
                onPress={() => alterarModoLeitura('manual')}
              >
                <Text
                  style={[
                    styles.modoLeituraButtonText,
                    modoLeitura === 'manual' &&
                      styles.modoLeituraButtonTextAtivo,
                  ]}
                >
                  MANUAL
                </Text>
              </Pressable>
            </View>

            <Text style={styles.fieldHint}>
              Automática lê assim que o código entra na área
              marcada. Manual espera você tocar em "Ler".
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              PROTEÇÃO CONTRA REPETIÇÃO (MS)
            </Text>

            <TextInput
              style={styles.input}
              value={velocidadeTexto}
              onChangeText={alterarVelocidade}
              placeholder="2500"
              placeholderTextColor="#98A2B3"
              keyboardType="number-pad"
            />

            <Text style={styles.fieldHint}>
              Evita que o mesmo código seja registrado várias
              vezes rapidamente enquanto permanece diante da
              câmera.
            </Text>
          </View>

          {/* SOM E VIBRAÇÃO */}
          <Text style={styles.sectionTitle}>🔊  SOM E VIBRAÇÃO</Text>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Som</Text>
                <Text style={styles.toggleHint}>
                  Toca um som ao escanear cada código.
                </Text>
              </View>
              <Switch
                value={somAtivado}
                onValueChange={alterarSom}
                trackColor={{ false: '#E4E7EC', true: '#208AEF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Vibração</Text>
                <Text style={styles.toggleHint}>
                  Vibra ao escanear cada código.
                </Text>
              </View>
              <Switch
                value={vibrarAtivado}
                onValueChange={alterarVibracao}
                trackColor={{ false: '#E4E7EC', true: '#208AEF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* PRODUTOS */}
          <Text style={styles.sectionTitle}>📦  PRODUTOS</Text>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push('/consulta-produto')}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Ver produtos</Text>
              <Text style={styles.actionText}>
                Busque e edite qualquer produto da base.
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push('/cadastrar-produto')}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Cadastrar produto</Text>
              <Text style={styles.actionText}>
                Adicione um produto novo do zero.
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push('/gerenciar-produtos')}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Gerenciar produtos</Text>
              <Text style={styles.actionText}>
                {produtosParaRevisar > 0
                  ? `${produtosParaRevisar} produto(s) manuais ou não identificados para revisar.`
                  : 'Produtos manuais e não identificados aparecem aqui.'}
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          {/* DADOS */}
          <Text style={styles.sectionTitle}>🗄️  DADOS</Text>

          <Pressable
            style={[styles.actionCard, reimportando && styles.cardDisabled]}
            onPress={() => {
              void importarCatalogoDoDispositivo();
            }}
            disabled={reimportando}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>
                Importar catálogo do dispositivo
              </Text>
              <Text style={styles.actionText}>
                Escolha um arquivo .json do Android para
                substituir o catálogo atual. Produtos manuais
                e não identificados não são afetados.
              </Text>
            </View>

            {reimportando ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.actionArrow}>›</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.actionCard, exportando && styles.cardDisabled]}
            onPress={() => {
              void exportarHistorico();
            }}
            disabled={exportando}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>
                Exportar conferências finalizadas
              </Text>
              <Text style={styles.actionText}>
                Compartilha um resumo de texto por WhatsApp,
                e-mail ou qualquer outro app.
              </Text>
            </View>

            {exportando ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.actionArrow}>›</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.dangerCard}
            onPress={() => setMostrarConfirmacaoApagar(true)}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.dangerTitle}>
                Apagar histórico finalizado
              </Text>
              <Text style={styles.actionText}>
                Remove permanentemente todas as conferências
                já finalizadas. Não afeta conferências em
                andamento nem o catálogo.
              </Text>
            </View>

            <Text style={styles.dangerArrow}>›</Text>
          </Pressable>

          <Pressable
            style={styles.dangerCard}
            onPress={() => setMostrarConfirmacaoResetar(true)}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.dangerTitle}>
                Resetar banco de dados
              </Text>
              <Text style={styles.actionText}>
                Apaga TODAS as conferências (em andamento e
                finalizadas) e produtos manuais/não
                identificados. Reimporta o catálogo do zero.
              </Text>
            </View>

            <Text style={styles.dangerArrow}>›</Text>
          </Pressable>

          {/* SOBRE */}
          <Text style={styles.sectionTitle}>ℹ️  SOBRE</Text>

          <View style={styles.card}>
            <View style={styles.sobreRow}>
              <Text style={styles.sobreLabel}>Versão</Text>
              <Text style={styles.sobreValor}>{versaoApp}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.sobreRow}>
              <Text style={styles.sobreLabel}>Base de produtos</Text>
              <Text style={styles.sobreValor}>
                {totalProdutos} produto(s)
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.sobreRow}>
              <Text style={styles.sobreLabel}>Banco de dados</Text>
              <Text style={styles.sobreValor}>SQLite</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.sobreRow}>
              <Text style={styles.sobreLabel}>Última atualização</Text>
              <Text style={styles.sobreValor}>
                {formatarData(catalogoAtualizadoEm)}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {mostrarConfirmacaoApagar && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>⚠️</Text>

            <Text style={styles.confirmTitle}>
              APAGAR TODO O HISTÓRICO?
            </Text>

            <Text style={styles.confirmText}>
              Esta ação não pode ser desfeita. Todas as
              conferências finalizadas serão apagadas
              permanentemente.
            </Text>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setMostrarConfirmacaoApagar(false)}
              disabled={apagando}
            >
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmDangerButton,
                apagando && styles.cardDisabled,
              ]}
              onPress={() => {
                void confirmarApagarHistorico();
              }}
              disabled={apagando}
            >
              {apagando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmDangerButtonText}>
                  SIM, APAGAR TUDO
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {mostrarConfirmacaoResetar && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>⚠️</Text>

            <Text style={styles.confirmTitle}>
              RESETAR BANCO DE DADOS?
            </Text>

            <Text style={styles.confirmText}>
              Isso apaga TODAS as conferências (mesmo as em
              andamento) e todos os produtos manuais ou não
              identificados. O catálogo original será
              reimportado do zero. Esta ação não pode ser
              desfeita.
            </Text>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setMostrarConfirmacaoResetar(false)}
              disabled={resetando}
            >
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmDangerButton,
                resetando && styles.cardDisabled,
              ]}
              onPress={() => {
                void confirmarResetarBanco();
              }}
              disabled={resetando}
            >
              {resetando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmDangerButtonText}>
                  SIM, RESETAR TUDO
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  messageBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EAF4FF',
    marginBottom: 16,
  },

  messageText: {
    fontSize: 13,
    color: '#175CD3',
    textAlign: 'center',
    fontWeight: '600',
  },

  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: 10,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.5,
  },

  fieldHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: '#98A2B3',
  },

  input: {
    marginTop: 8,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#18212F',
  },

  modoLeituraRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },

  modoLeituraButton: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modoLeituraButtonAtivo: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },

  modoLeituraButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#667085',
  },

  modoLeituraButtonTextAtivo: {
    color: '#FFFFFF',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },

  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18212F',
  },

  toggleHint: {
    marginTop: 2,
    fontSize: 11,
    color: '#98A2B3',
  },

  divider: {
    height: 1,
    backgroundColor: '#F2F4F7',
    marginVertical: 12,
  },

  sobreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },

  sobreLabel: {
    fontSize: 13,
    color: '#667085',
  },

  sobreValor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18212F',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },

  actionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardDisabled: {
    opacity: 0.6,
  },

  actionInfo: {
    flex: 1,
    marginRight: 10,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18212F',
  },

  actionText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#667085',
  },

  actionArrow: {
    fontSize: 26,
    color: '#98A2B3',
  },

  dangerCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#FECDCA',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B42318',
  },

  dangerArrow: {
    fontSize: 26,
    color: '#F04438',
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  confirmCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },

  confirmIcon: {
    fontSize: 34,
    marginBottom: 10,
  },

  confirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  confirmText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#475467',
    textAlign: 'center',
  },

  cancelButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 22,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  confirmDangerButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmDangerButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F04438',
  },
});
