import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  atualizarProduto,
  atualizarStatusLeitura,
  completarProdutoDesconhecido,
  editarQuantidadeLeitura,
  formatarCodigoInterno,
  finalizarConferencia,
  importarNfItens,
  marcarStatusRevisao,
  obterConferencia,
  obterLeiturasConferencia,
  obterNfItens,
  obterResumoConferencia,
  obterResumoRevisao,
  removerLeituraConferencia,
} from '@/database/database';
import type {
  Conferencia,
  DadosProdutoRapido,
  LeituraConferencia,
  NfItem,
  ResumoConferencia,
  ResumoRevisao,
  StatusLeitura,
  StatusRevisao,
  TipoProduto,
} from '@/models/produto';
import { CORES_STATUS } from '@/constants/cores';
import { ModalEdicaoItem } from '@/components/ModalEdicaoItem';
import { compararConferencia, type ResultadoComparacao } from '@/services/comparacao';

// ============================================================
// TELA DE RESULTADO / REVISÃO DA CONFERÊNCIA
// ============================================================

export default function ResultadoScreen() {
  const { conferenciaId: conferenciaIdParam } =
    useLocalSearchParams<{ conferenciaId: string }>();

  const conferenciaId = Number(conferenciaIdParam);
  const conferenciaValida =
    Boolean(conferenciaIdParam) && !Number.isNaN(conferenciaId);

  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [leituras, setLeituras] = useState<LeituraConferencia[]>([]);
  const [resumo, setResumo] = useState<ResumoConferencia | null>(null);
  const [resumoRevisao, setResumoRevisao] = useState<ResumoRevisao | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarConfirmacaoFinalizar, setMostrarConfirmacaoFinalizar] = useState(false);

  const [nfItens, setNfItens] = useState<NfItem[]>([]);
  const [importandoNf, setImportandoNf] = useState(false);
  const [mensagemNf, setMensagemNf] = useState<string | null>(null);

  const [itemEditando, setItemEditando] = useState<LeituraConferencia | null>(null);
  const [qtdEdit, setQtdEdit] = useState<{ item: LeituraConferencia; qtd: number } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const modoRevisao = conferencia?.status === 'em_andamento';

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (qtdEdit) { setQtdEdit(null); return true; }
        if (itemEditando) { setItemEditando(null); return true; }
        if (mostrarConfirmacaoFinalizar) { setMostrarConfirmacaoFinalizar(false); return true; }
        return false;
      });
      return () => sub.remove();
    }, [qtdEdit, itemEditando, mostrarConfirmacaoFinalizar]),
  );

  // ==========================================================
  // CARREGAR DADOS
  // ==========================================================

  async function carregarDados() {
    if (!conferenciaValida) {
      setCarregando(false);
      setErro('Conferência inválida.');
      return;
    }

    try {
      const [dadosConferencia, listaLeituras, resumoConferencia, resumoRev, itensNf] =
        await Promise.all([
          obterConferencia(conferenciaId),
          obterLeiturasConferencia(conferenciaId),
          obterResumoConferencia(conferenciaId),
          obterResumoRevisao(conferenciaId),
          obterNfItens(conferenciaId),
        ]);

      if (!dadosConferencia) {
        setErro('Conferência não encontrada.');
        setCarregando(false);
        return;
      }

      setConferencia(dadosConferencia);
      setLeituras(listaLeituras);
      setResumo(resumoConferencia);
      setResumoRevisao(resumoRev);
      setNfItens(itensNf);
      setCarregando(false);
    } catch (error) {
      console.error('Erro ao carregar resultado da conferência:', error);
      setErro('Não foi possível carregar o resultado.');
      setCarregando(false);
    }
  }

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      await carregarDados();
      if (!ativo) return;
    }

    carregar();

    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenciaId, conferenciaValida]);

  // ==========================================================
  // RECARREGAR RESUMOS
  // ==========================================================

  async function recarregarResumos() {
    if (!conferenciaValida) return;

    const [novoResumo, novoResumoRevisao] = await Promise.all([
      obterResumoConferencia(conferenciaId),
      obterResumoRevisao(conferenciaId),
    ]);

    setResumo(novoResumo);
    setResumoRevisao(novoResumoRevisao);
  }

  // ==========================================================
  // REVISÃO POR EXCEÇÃO — toggle ok ↔ divergencia
  // ==========================================================

  async function alterarRevisao(item: LeituraConferencia) {
    if (!conferenciaValida) return;

    // Pendente (legado) → divergencia ao tocar; divergencia → ok; ok → divergencia
    const statusFinal: StatusRevisao =
      item.statusRevisao === 'divergencia' ? 'ok' : 'divergencia';

    try {
      await marcarStatusRevisao(conferenciaId, item.produto.codigoInterno, statusFinal);

      // Ordem: divergencias primeiro, pendente legado depois, ok por último
      const ordemRevisao: Record<StatusRevisao, number> = {
        divergencia: 0,
        pendente: 1,
        ok: 2,
      };

      const listaAtualizada = leituras
        .map((l) =>
          l.produto.codigoInterno === item.produto.codigoInterno
            ? { ...l, statusRevisao: statusFinal }
            : l,
        )
        .sort((a, b) => ordemRevisao[a.statusRevisao] - ordemRevisao[b.statusRevisao]);

      setLeituras(listaAtualizada);

      const novoResumoRevisao = await obterResumoRevisao(conferenciaId);
      setResumoRevisao(novoResumoRevisao);
    } catch (error) {
      console.error('Erro ao marcar status de revisão:', error);
    }
  }

  // ==========================================================
  // EDIÇÃO DE ITEM
  // ==========================================================

  async function handleImportarNf() {
    if (!conferenciaValida) return;
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.length) return;

      setImportandoNf(true);
      setMensagemNf(null);

      const arquivo = resultado.assets[0];
      const response = await fetch(arquivo.uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < uint8.length; i += chunk) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);

      const res = await importarNfItens(conferenciaId, base64);
      const itensAtualizados = await obterNfItens(conferenciaId);
      setNfItens(itensAtualizados);

      let msg = `NF importada: ${res.carregados} ite${res.carregados !== 1 ? 'ns' : 'm'}`;
      if (res.ignorados > 0) msg += `, ${res.ignorados} ignorado${res.ignorados !== 1 ? 's' : ''}`;
      if (res.codigosDesconhecidos.length > 0) {
        msg += `. Não encontrados: ${res.codigosDesconhecidos.slice(0, 3).join(', ')}${res.codigosDesconhecidos.length > 3 ? '...' : ''}`;
      }
      setMensagemNf(msg);
    } catch (error) {
      setMensagemNf(error instanceof Error ? error.message : 'Erro ao importar NF.');
    } finally {
      setImportandoNf(false);
    }
  }

  async function salvarQtdRapida() {
    if (!qtdEdit || !conferenciaValida) return;
    const { item, qtd } = qtdEdit;
    setQtdEdit(null);
    const qtdValida = Math.max(0, Math.floor(qtd));
    try {
      if (qtdValida === 0) {
        await removerLeituraConferencia(conferenciaId, item.produto.codigoInterno);
        setLeituras((lista) => lista.filter((l) => l.produto.codigoInterno !== item.produto.codigoInterno));
      } else {
        await editarQuantidadeLeitura(conferenciaId, item.produto.codigoInterno, qtdValida);
        setLeituras((lista) =>
          lista.map((l) =>
            l.produto.codigoInterno === item.produto.codigoInterno ? { ...l, quantidade: qtdValida } : l,
          ),
        );
      }
      await recarregarResumos();
    } catch (error) {
      console.error('Erro ao editar quantidade:', error);
    }
  }

  function abrirEdicao(item: LeituraConferencia) {
    if (!modoRevisao) return;
    setItemEditando(item);
  }

  function fecharEdicao() {
    setItemEditando(null);
  }

  async function salvarQuantidade(novaQuantidade: number) {
    if (!itemEditando || !conferenciaValida) return;

    const quantidadeValida = Math.max(0, Math.floor(novaQuantidade));

    try {
      if (quantidadeValida === 0) {
        await removerLeituraConferencia(conferenciaId, itemEditando.produto.codigoInterno);

        setLeituras((lista) =>
          lista.filter(
            (item) => item.produto.codigoInterno !== itemEditando.produto.codigoInterno,
          ),
        );
      } else {
        await editarQuantidadeLeitura(
          conferenciaId,
          itemEditando.produto.codigoInterno,
          quantidadeValida,
        );

        setLeituras((lista) =>
          lista.map((item) =>
            item.produto.codigoInterno === itemEditando.produto.codigoInterno
              ? { ...item, quantidade: quantidadeValida }
              : item,
          ),
        );
      }

      await recarregarResumos();
      fecharEdicao();
    } catch (error) {
      console.error('Erro ao editar quantidade:', error);
    }
  }

  async function removerItem() {
    if (!itemEditando || !conferenciaValida) return;

    try {
      await removerLeituraConferencia(conferenciaId, itemEditando.produto.codigoInterno);

      setLeituras((lista) =>
        lista.filter(
          (item) => item.produto.codigoInterno !== itemEditando.produto.codigoInterno,
        ),
      );

      await recarregarResumos();
      fecharEdicao();
    } catch (error) {
      console.error('Erro ao remover item:', error);
    }
  }

  async function salvarComoProdutoNovo(dados: DadosProdutoRapido): Promise<void> {
    if (!itemEditando || !conferenciaValida) return;

    const novoCodigoInterno = await completarProdutoDesconhecido(
      itemEditando.produto.codigoInterno,
      dados,
    );

    await atualizarStatusLeitura(conferenciaId, novoCodigoInterno, 'novo');

    setLeituras((lista) =>
      lista.map((item) =>
        item.produto.codigoInterno === itemEditando.produto.codigoInterno
          ? {
              ...item,
              status: 'novo' as StatusLeitura,
              produto: {
                ...item.produto,
                codigoInterno: novoCodigoInterno,
                nome: dados.nome,
                marca: dados.marca,
                categoria: dados.categoria,
                subcategoria: dados.subcategoria,
                modelo: dados.modelo,
                capacidad: dados.capacidad,
                tecnologia: dados.tecnologia,
                ciclo: dados.ciclo,
                voltaje: dados.voltaje,
                color: dados.color,
                peso: dados.peso,
                dimensiones: dados.dimensiones,
                link: dados.link,
                tipoProduto: dados.tipoProduto ?? 'normal',
                codigoPar: dados.codigoPar,
                origem: 'manual',
              },
            }
          : item,
      ),
    );

    fecharEdicao();
  }

  async function atualizarTipo(tipo: TipoProduto): Promise<string | null> {
    if (!itemEditando) return null;

    try {
      await atualizarProduto(
        { ...itemEditando.produto, tipoProduto: tipo },
        itemEditando.produto.codigoInterno,
      );

      setLeituras((lista) =>
        lista.map((item) =>
          item.produto.codigoInterno === itemEditando.produto.codigoInterno
            ? { ...item, produto: { ...item.produto, tipoProduto: tipo } }
            : item,
        ),
      );

      return null;
    } catch {
      return 'Não foi possível salvar a alteração.';
    }
  }

  async function salvarDadosProduto(dados: {
    codigoInterno?: string;
    nome: string;
    marca?: string;
    categoria?: string;
    subcategoria?: string;
    modelo?: string;
    capacidad?: string;
    tecnologia?: string;
    ciclo?: string;
    voltaje?: string;
    color?: string;
    peso?: string;
    dimensiones?: string;
    link?: string;
  }): Promise<string | null> {
    if (!itemEditando) return null;

    const codigoOriginal = itemEditando.produto.codigoInterno;
    const novoCodigoInterno = dados.codigoInterno?.trim() || codigoOriginal;
    const produtoAtualizado = { ...itemEditando.produto, ...dados, codigoInterno: novoCodigoInterno };

    try {
      await atualizarProduto(produtoAtualizado, codigoOriginal);

      setLeituras((lista) =>
        lista.map((item) =>
          item.produto.codigoInterno === codigoOriginal
            ? { ...item, produto: produtoAtualizado }
            : item,
        ),
      );

      return null;
    } catch {
      return 'Não foi possível salvar os dados.';
    }
  }

  async function handleParear(
    codigoInternoSocio: string,
    codigoPar: string,
    tipoSocio: TipoProduto,
    tipoItem: TipoProduto,
  ): Promise<string | null> {
    if (!itemEditando) return null;

    try {
      await atualizarProduto(
        { ...itemEditando.produto, codigoPar, tipoProduto: tipoItem },
        itemEditando.produto.codigoInterno,
      );

      const socio = leituras.find((it) => it.produto.codigoInterno === codigoInternoSocio);
      if (socio) {
        const tipoProdutoSocio =
          socio.produto.tipoProduto === 'normal' ? tipoSocio : socio.produto.tipoProduto;
        await atualizarProduto(
          { ...socio.produto, codigoPar, tipoProduto: tipoProdutoSocio },
          socio.produto.codigoInterno,
        );
        setLeituras((lista) =>
          lista.map((it) =>
            it.produto.codigoInterno === codigoInternoSocio
              ? { ...it, produto: { ...it.produto, codigoPar, tipoProduto: tipoProdutoSocio } }
              : it,
          ),
        );
      }

      setLeituras((lista) =>
        lista.map((it) =>
          it.produto.codigoInterno === itemEditando.produto.codigoInterno
            ? { ...it, produto: { ...it.produto, codigoPar, tipoProduto: tipoItem } }
            : it,
        ),
      );

      return null;
    } catch {
      return 'Não foi possível parear.';
    }
  }

  async function handleDesparear(): Promise<string | null> {
    if (!itemEditando) return null;

    const codigoParAtual = itemEditando.produto.codigoPar;
    if (!codigoParAtual) return null;

    try {
      await atualizarProduto(
        { ...itemEditando.produto, codigoPar: undefined },
        itemEditando.produto.codigoInterno,
      );

      const socio = leituras.find(
        (it) =>
          it.produto.codigoPar === codigoParAtual &&
          it.produto.codigoInterno !== itemEditando.produto.codigoInterno,
      );
      if (socio) {
        await atualizarProduto(
          { ...socio.produto, codigoPar: undefined },
          socio.produto.codigoInterno,
        );
      }

      setLeituras((lista) =>
        lista.map((it) =>
          it.produto.codigoInterno === itemEditando.produto.codigoInterno ||
          it.produto.codigoInterno === socio?.produto.codigoInterno
            ? { ...it, produto: { ...it.produto, codigoPar: undefined } }
            : it,
        ),
      );

      return null;
    } catch {
      return 'Não foi possível desparear.';
    }
  }

  // ==========================================================
  // CONFIRMAR FINALIZAÇÃO
  // ==========================================================

  async function confirmarFinalizacao() {
    if (!conferenciaValida || finalizando) return;

    setFinalizando(true);
    setMostrarConfirmacaoFinalizar(false);

    try {
      await finalizarConferencia(conferenciaId);
      router.replace('/');
    } catch (error) {
      console.error('Erro ao finalizar conferência:', error);
      setFinalizando(false);
    }
  }

  const totalUnidades = leituras.reduce((total, item) => total + item.quantidade, 0);

  const itensOrganizados = useMemo(() => {
    const grupos: Record<string, LeituraConferencia[]> = {};
    const individuais: LeituraConferencia[] = [];

    for (const item of leituras) {
      if (
        item.produto.codigoPar &&
        (item.produto.tipoProduto === 'evaporadora' ||
          item.produto.tipoProduto === 'condensadora')
      ) {
        grupos[item.produto.codigoPar] = grupos[item.produto.codigoPar] ?? [];
        grupos[item.produto.codigoPar].push(item);
      } else {
        individuais.push(item);
      }
    }

    for (const g of Object.values(grupos)) {
      g.sort((a) => (a.produto.tipoProduto === 'evaporadora' ? -1 : 1));
    }

    return { grupos, individuais };
  }, [leituras]);

  // Comparação NF (só quando há itens carregados)
  const comparacaoNf = useMemo((): ResultadoComparacao | null => {
    if (nfItens.length === 0) return null;
    const lidos = leituras.map((l) => ({
      codigoInterno: l.produto.codigoInterno,
      quantidade: l.quantidade,
    }));
    return compararConferencia(lidos, nfItens);
  }, [leituras, nfItens]);

  const nomesNf = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const l of leituras) {
      mapa.set(l.produto.codigoInterno, l.produto.nome);
    }
    return mapa;
  }, [leituras]);

  // Divergencias para el modal de confirmación (máx 5)
  const divergenciasModal = useMemo(
    () => leituras.filter((l) => l.statusRevisao === 'divergencia').slice(0, 5),
    [leituras],
  );

  // ==========================================================
  // CARREGANDO
  // ==========================================================

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Carregando resultado...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // ERRO
  // ==========================================================

  if (erro || !conferencia || !resumo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>
            {erro ?? 'Não foi possível carregar o resultado.'}
          </Text>
          <Pressable style={styles.backButtonError} onPress={() => router.replace('/')}>
            <Text style={styles.backButtonErrorText}>VOLTAR AO INÍCIO</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // INTERFACE PRINCIPAL
  // ==========================================================

  const totalDivergencias = resumoRevisao?.divergencia ?? 0;
  const totalItens = leituras.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{conferencia.nome}</Text>
            <Text style={styles.headerSubtitle}>
              {modoRevisao
                ? 'Revisão antes de finalizar'
                : conferencia.status === 'cancelada'
                ? 'Cancelada'
                : 'Finalizada'}
            </Text>
          </View>
          <Pressable
            style={[styles.headerNfButton, importandoNf && { opacity: 0.5 }]}
            onPress={() => { void handleImportarNf(); }}
            disabled={importandoNf}
          >
            {importandoNf ? (
              <ActivityIndicator size="small" color="#175CD3" />
            ) : (
              <Text style={styles.headerNfButtonText}>
                {nfItens.length > 0 ? '📋' : '📋 NF'}
              </Text>
            )}
          </Pressable>
        </View>

        {mensagemNf && (
          <Pressable onPress={() => setMensagemNf(null)}>
            <Text style={styles.nfMensagemImport}>{mensagemNf}</Text>
          </Pressable>
        )}

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* Resumo de contagens */}
          <View style={styles.summaryCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>
                {modoRevisao
                  ? '📋'
                  : conferencia.status === 'cancelada'
                  ? '🗑️'
                  : '✓'}
              </Text>
            </View>

            <Text style={styles.summaryTitle}>
              {modoRevisao
                ? 'REVISE ANTES DE FINALIZAR'
                : conferencia.status === 'cancelada'
                ? 'CONFERÊNCIA CANCELADA'
                : 'CONFERÊNCIA FINALIZADA'}
            </Text>

            <Text style={styles.summaryDescription}>
              {modoRevisao
                ? 'Marque divergências se necessário. Tudo OK por padrão.'
                : 'A leitura dos produtos foi concluída.'}
            </Text>

            <View style={styles.summaryNumbers}>
              <View style={styles.numberItem}>
                <Text style={styles.numberValue}>{resumo.produtosLidos}</Text>
                <Text style={styles.numberLabel}>Produtos</Text>
              </View>

              <View style={styles.numberDivider} />

              <View style={styles.numberItem}>
                <Text style={styles.numberValue}>{totalUnidades}</Text>
                <Text style={styles.numberLabel}>Itens</Text>
              </View>

              {resumo.produtosNaoEncontrados > 0 && (
                <>
                  <View style={styles.numberDivider} />
                  <View style={styles.numberItem}>
                    <Text style={[styles.numberValue, styles.numberValueAlerta]}>
                      {resumo.produtosNaoEncontrados}
                    </Text>
                    <Text style={styles.numberLabel}>Não identif.</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Barra de divergencias (somente modo revisão) */}
          {modoRevisao && resumoRevisao && (
            <View style={styles.divBar}>
              {totalDivergencias === 0 ? (
                <Text style={styles.divBarZero}>✓ Sem divergências</Text>
              ) : (
                <Text style={styles.divBarAlerta}>
                  ⚠ {totalDivergencias} divergência{totalDivergencias !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          )}

          {/* Batimento NF */}
          {comparacaoNf && (
            <View style={styles.nfContainer}>
              <Text style={styles.nfTitulo}>BATIMENTO COM A NF</Text>

              {comparacaoNf.faltantes.length === 0 &&
               comparacaoNf.sobrantes.length === 0 &&
               comparacaoNf.naoEsperados.length === 0 ? (
                <View style={styles.nfOkBox}>
                  <Text style={styles.nfOkIcon}>✓</Text>
                  <Text style={styles.nfOkTexto}>
                    Bate — {comparacaoNf.coincidentes} ite{comparacaoNf.coincidentes !== 1 ? 'ns' : 'm'} conferidos
                  </Text>
                </View>
              ) : (
                <>
                  {comparacaoNf.faltantes.length > 0 && (
                    <View style={styles.nfSecao}>
                      <View style={styles.nfSecaoHeader}>
                        <View style={[styles.nfSecaoBadge, styles.nfSecaoBadgeFaltante]}>
                          <Text style={styles.nfSecaoBadgeText}>{comparacaoNf.faltantes.length}</Text>
                        </View>
                        <Text style={[styles.nfSecaoTitulo, styles.nfSecaoTituloFaltante]}>Faltantes</Text>
                      </View>
                      {comparacaoNf.faltantes.map((item) => (
                        <View key={item.codigoInterno} style={styles.nfLinha}>
                          <View style={styles.nfLinhaInfo}>
                            <Text style={styles.nfLinhaCodigo}>{formatarCodigoInterno(item.codigoInterno)}</Text>
                            <Text style={styles.nfLinhaNome} numberOfLines={1}>{nomesNf.get(item.codigoInterno) ?? '—'}</Text>
                          </View>
                          <Text style={styles.nfLinhaQtdTexto}>
                            <Text style={styles.nfLinhaQtdNeg}>{item.lido}</Text>
                            {` / ${item.esperado} esp`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {comparacaoNf.sobrantes.length > 0 && (
                    <View style={styles.nfSecao}>
                      <View style={styles.nfSecaoHeader}>
                        <View style={[styles.nfSecaoBadge, styles.nfSecaoBadgeSobrante]}>
                          <Text style={styles.nfSecaoBadgeText}>{comparacaoNf.sobrantes.length}</Text>
                        </View>
                        <Text style={[styles.nfSecaoTitulo, styles.nfSecaoTituloSobrante]}>Sobrantes</Text>
                      </View>
                      {comparacaoNf.sobrantes.map((item) => (
                        <View key={item.codigoInterno} style={styles.nfLinha}>
                          <View style={styles.nfLinhaInfo}>
                            <Text style={styles.nfLinhaCodigo}>{formatarCodigoInterno(item.codigoInterno)}</Text>
                            <Text style={styles.nfLinhaNome} numberOfLines={1}>{nomesNf.get(item.codigoInterno) ?? '—'}</Text>
                          </View>
                          <Text style={styles.nfLinhaQtdTexto}>
                            <Text style={styles.nfLinhaQtdPos}>{item.lido}</Text>
                            {` / ${item.esperado} esp`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {comparacaoNf.naoEsperados.length > 0 && (
                    <View style={styles.nfSecao}>
                      <View style={styles.nfSecaoHeader}>
                        <View style={[styles.nfSecaoBadge, styles.nfSecaoBadgeNaoEsp]}>
                          <Text style={styles.nfSecaoBadgeText}>{comparacaoNf.naoEsperados.length}</Text>
                        </View>
                        <Text style={[styles.nfSecaoTitulo, styles.nfSecaoTituloNaoEsp]}>Não esperados</Text>
                      </View>
                      {comparacaoNf.naoEsperados.map((item) => (
                        <View key={item.codigoInterno} style={styles.nfLinha}>
                          <View style={styles.nfLinhaInfo}>
                            <Text style={styles.nfLinhaCodigo}>{formatarCodigoInterno(item.codigoInterno)}</Text>
                            <Text style={styles.nfLinhaNome} numberOfLines={1}>{nomesNf.get(item.codigoInterno) ?? '—'}</Text>
                          </View>
                          <Text style={[styles.nfLinhaQtdTexto, styles.nfLinhaQtdNaoEsp]}>lido {item.lido}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Lista de produtos */}
          <Text style={styles.sectionTitle}>PRODUTOS CONFERIDOS</Text>

          {leituras.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhum produto foi lido nesta conferência.</Text>
            </View>
          ) : (
            <>
              {/* Pares agrupados */}
              {Object.entries(itensOrganizados.grupos).map(([codigoPar, items]) => {
                const ambosPresentes =
                  items.some((i) => i.produto.tipoProduto === 'evaporadora') &&
                  items.some((i) => i.produto.tipoProduto === 'condensadora') &&
                  items.length === 2;
                return (
                  <View key={`par-${codigoPar}`}>
                    <View style={styles.parHeader}>
                      <Text style={styles.parHeaderText}>❄ CONJUNTO</Text>
                      <Text style={styles.parHeaderCodigo}>{codigoPar}</Text>
                      {ambosPresentes ? (
                        <View style={styles.parHeaderBadge}>
                          <Text style={styles.parHeaderBadgeText}>COMPLETO</Text>
                        </View>
                      ) : (
                        <Text style={styles.parHeaderIncompleto}>falta parte</Text>
                      )}
                    </View>
                    {items.map((item) => {
                      const cor = CORES_STATUS[item.status];
                      const eDiv = item.statusRevisao === 'divergencia';
                      const eLegado = item.statusRevisao === 'pendente';
                      return (
                        <View
                          key={item.produto.codigoInterno}
                          style={[
                            styles.productCard,
                            styles.productCardPar,
                            { borderColor: eDiv ? '#F04438' : cor.borda, backgroundColor: eDiv ? '#FFF1F0' : cor.fundo },
                          ]}
                        >
                          <Pressable
                            style={styles.productMain}
                            onPress={() => abrirEdicao(item)}
                            disabled={!modoRevisao}
                          >
                            <View style={[styles.productCodeBox, { backgroundColor: eDiv ? '#F04438' : cor.borda }]}>
                              <Text style={styles.productCode}>{formatarCodigoInterno(item.produto.codigoInterno)}</Text>
                            </View>
                            <View style={styles.productInfo}>
                              <Text style={styles.productName} numberOfLines={1}>{item.produto.nome}</Text>
                              {item.produto.modelo ? (
                                <Text style={styles.productModelo} numberOfLines={1}>{item.produto.modelo}</Text>
                              ) : null}
                              <View style={styles.productMetaRow}>
                                <View style={[styles.badgeSmall, { backgroundColor: eDiv ? '#F04438' : cor.borda }]}>
                                  <Text style={styles.badgeSmallText}>{cor.etiqueta}</Text>
                                </View>
                                <Text style={[styles.acParteBadge, item.produto.tipoProduto === 'evaporadora' ? styles.acParteBadgeEva : styles.acParteBadgeCond]}>
                                  {item.produto.tipoProduto === 'evaporadora' ? '❄ Eva' : '❄ Cond'}
                                </Text>
                                {eLegado && (
                                  <Text style={styles.legadoBadge}>legado</Text>
                                )}
                              </View>
                              {modoRevisao && (
                                <Text style={styles.editHint}>toque para editar</Text>
                              )}
                            </View>
                            <Pressable
                              style={styles.quantityBox}
                              onPress={() => { if (modoRevisao) setQtdEdit({ item, qtd: item.quantidade }); }}
                            >
                              <Text style={styles.quantityValue}>{item.quantidade}</Text>
                              <Text style={styles.quantityLabel}>{'QTD'}</Text>
                            </Pressable>
                          </Pressable>
                          {modoRevisao && (
                            <Pressable
                              style={[styles.btnDiv, eDiv && styles.btnDivAtivo]}
                              onPress={() => void alterarRevisao(item)}
                            >
                              <Text style={[styles.btnDivTexto, eDiv && styles.btnDivTextoAtivo]}>
                                {eDiv ? '✗ Divergência' : '✗ Divergência'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {/* Individuais */}
              {itensOrganizados.individuais.map((item) => {
                const cor = CORES_STATUS[item.status];
                const eDiv = item.statusRevisao === 'divergencia';
                const eLegado = item.statusRevisao === 'pendente';
                return (
                  <View
                    key={item.produto.codigoInterno}
                    style={[
                      styles.productCard,
                      { borderColor: eDiv ? '#F04438' : cor.borda, backgroundColor: eDiv ? '#FFF1F0' : cor.fundo },
                    ]}
                  >
                    <Pressable
                      style={styles.productMain}
                      onPress={() => abrirEdicao(item)}
                      disabled={!modoRevisao}
                    >
                      <View style={[styles.productCodeBox, { backgroundColor: eDiv ? '#F04438' : cor.borda }]}>
                        <Text style={styles.productCode}>{formatarCodigoInterno(item.produto.codigoInterno)}</Text>
                      </View>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={1}>{item.produto.nome}</Text>
                        {item.produto.modelo ? (
                          <Text style={styles.productModelo} numberOfLines={1}>{item.produto.modelo}</Text>
                        ) : null}
                        <View style={styles.productMetaRow}>
                          <View style={[styles.badgeSmall, { backgroundColor: eDiv ? '#F04438' : cor.borda }]}>
                            <Text style={styles.badgeSmallText}>{cor.etiqueta}</Text>
                          </View>
                          {item.produto.tipoProduto !== 'normal' && (
                            <Text style={[styles.acParteBadge, styles.acParteBadgeTipo]}>
                              {item.produto.tipoProduto === 'evaporadora' ? '❄ Eva' : '❄ Cond'}
                            </Text>
                          )}
                          {eLegado && (
                            <Text style={styles.legadoBadge}>legado</Text>
                          )}
                        </View>
                        {modoRevisao && (
                          <Text style={styles.editHint}>toque para editar</Text>
                        )}
                      </View>
                      <Pressable
                        style={styles.quantityBox}
                        onPress={() => { if (modoRevisao) setQtdEdit({ item, qtd: item.quantidade }); }}
                      >
                        <Text style={styles.quantityValue}>{item.quantidade}</Text>
                        <Text style={styles.quantityLabel}>{'QTD'}</Text>
                      </Pressable>
                    </Pressable>
                    {modoRevisao && (
                      <Pressable
                        style={[styles.btnDiv, eDiv && styles.btnDivAtivo]}
                        onPress={() => void alterarRevisao(item)}
                      >
                        <Text style={[styles.btnDivTexto, eDiv && styles.btnDivTextoAtivo]}>
                          ✗ Divergência
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </>
          )}

        </ScrollView>

        {/* Ações */}
        {modoRevisao ? (
          <>
            <Pressable
              style={[styles.confirmButton, finalizando && styles.buttonDisabled]}
              onPress={() => setMostrarConfirmacaoFinalizar(true)}
              disabled={finalizando}
            >
              {finalizando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.confirmIcon}>✓</Text>
                  <Text style={styles.confirmText}>CONFIRMAR E FINALIZAR</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.newButton}
              onPress={() => router.back()}
              disabled={finalizando}
            >
              <Text style={styles.newText}>CONTINUAR LENDO</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.confirmButton} onPress={() => router.back()}>
            <Text style={styles.confirmText}>VOLTAR</Text>
          </Pressable>
        )}

      </View>

      {/* Modal rápido de quantidade */}
      {qtdEdit && modoRevisao && (
        <View style={styles.overlay}>
          <View style={styles.qtdCard}>
            <Text style={styles.qtdCardCodigo}>{formatarCodigoInterno(qtdEdit.item.produto.codigoInterno)}</Text>
            <Text style={styles.qtdCardNome} numberOfLines={2}>{qtdEdit.item.produto.nome}</Text>
            <View style={styles.qtdControle}>
              <Pressable
                style={styles.qtdBtn}
                onPress={() => setQtdEdit((prev) => prev ? { ...prev, qtd: Math.max(0, prev.qtd - 1) } : null)}
              >
                <Text style={styles.qtdBtnTexto}>−</Text>
              </Pressable>
              <Text style={styles.qtdNumero}>{qtdEdit.qtd}</Text>
              <Pressable
                style={styles.qtdBtn}
                onPress={() => setQtdEdit((prev) => prev ? { ...prev, qtd: prev.qtd + 1 } : null)}
              >
                <Text style={styles.qtdBtnTexto}>+</Text>
              </Pressable>
            </View>
            {qtdEdit.qtd === 0 && (
              <Text style={styles.qtdAvisoRemover}>Quantidade 0 vai remover o item</Text>
            )}
            <Pressable style={styles.qtdSalvar} onPress={() => { void salvarQtdRapida(); }}>
              <Text style={styles.qtdSalvarTexto}>SALVAR</Text>
            </Pressable>
            <Pressable style={styles.qtdCancelar} onPress={() => setQtdEdit(null)}>
              <Text style={styles.qtdCancelarTexto}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Modal de edição de item */}
      {itemEditando && (
        <ModalEdicaoItem
          item={itemEditando}
          onFechar={fecharEdicao}
          onSalvarQuantidade={salvarQuantidade}
          onRemover={removerItem}
          onSalvarProdutoNovo={salvarComoProdutoNovo}
          onAtualizarTipo={atualizarTipo}
          onSalvarDadosProduto={salvarDadosProduto}
          itensConferencia={leituras}
          onParear={handleParear}
          onDesparear={handleDesparear}
        />
      )}

      {/* Modal de confirmação de finalização */}
      {mostrarConfirmacaoFinalizar && resumoRevisao && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmCardIcon}>📋</Text>

            <Text style={styles.confirmCardTitle}>FINALIZAR CONFERÊNCIA?</Text>

            <View style={styles.confirmResumoRow}>
              <View style={[styles.confirmResumoItem, styles.confirmResumoTotal]}>
                <Text style={styles.confirmResumoNum}>{totalItens}</Text>
                <Text style={styles.confirmResumoLabel}>Itens</Text>
              </View>
              <View style={[styles.confirmResumoItem, totalDivergencias > 0 ? styles.confirmResumoDiv : styles.confirmResumoOk]}>
                <Text style={styles.confirmResumoNum}>{totalDivergencias}</Text>
                <Text style={styles.confirmResumoLabel}>Divergências</Text>
              </View>
            </View>

            {divergenciasModal.length > 0 && (
              <View style={styles.confirmDivLista}>
                <Text style={styles.confirmDivListaTitulo}>Produtos com divergência:</Text>
                {divergenciasModal.map((l) => (
                  <View key={l.produto.codigoInterno} style={styles.confirmDivItem}>
                    <Text style={styles.confirmDivCodigo}>{formatarCodigoInterno(l.produto.codigoInterno)}</Text>
                    <Text style={styles.confirmDivNome} numberOfLines={1}>{l.produto.nome}</Text>
                    <Text style={styles.confirmDivQtd}>Qtd: {l.quantidade}</Text>
                  </View>
                ))}
                {resumoRevisao.divergencia > 5 && (
                  <Text style={styles.confirmDivMais}>
                    +{resumoRevisao.divergencia - 5} mais...
                  </Text>
                )}
              </View>
            )}

            <Pressable
              style={styles.confirmFinalButton}
              onPress={() => void confirmarFinalizacao()}
              disabled={finalizando}
            >
              {finalizando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmFinalButtonText}>SIM, FINALIZAR</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.confirmCancelButton}
              onPress={() => setMostrarConfirmacaoFinalizar(false)}
              disabled={finalizando}
            >
              <Text style={styles.confirmCancelButtonText}>VOLTAR À REVISÃO</Text>
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
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  centerContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30,
  },

  loadingText: { marginTop: 14, fontSize: 14, color: '#667085', textAlign: 'center' },

  errorIcon: { fontSize: 42, marginBottom: 14 },

  errorText: { fontSize: 14, lineHeight: 21, color: '#667085', textAlign: 'center' },

  backButtonError: {
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 13, backgroundColor: '#208AEF',
  },

  backButtonErrorText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  content: { flex: 1, paddingHorizontal: 20 },

  scrollContent: { paddingBottom: 20 },

  header: {
    height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  backIcon: { fontSize: 38, lineHeight: 42, color: '#18212F' },

  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },

  headerTitle: { fontSize: 16, fontWeight: '800', color: '#18212F' },

  headerSubtitle: { marginTop: 2, fontSize: 11, color: '#667085' },

  headerSpace: { width: 44 },

  headerNfButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#EFF8FF',
  },

  headerNfButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#175CD3',
  },

  nfMensagemImport: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 12,
    color: '#344054',
    backgroundColor: '#F2F4F7',
    borderRadius: 6,
    padding: 8,
  },

  summaryCard: {
    marginTop: 12, padding: 20, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center', elevation: 2,
  },

  successIcon: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#ECFDF3', alignItems: 'center', justifyContent: 'center',
  },

  successIconText: { fontSize: 28, color: '#12B76A' },

  summaryTitle: {
    marginTop: 12, fontSize: 17, fontWeight: '800', color: '#18212F', textAlign: 'center',
  },

  summaryDescription: { marginTop: 6, textAlign: 'center', fontSize: 13, color: '#667085' },

  summaryNumbers: {
    width: '100%', marginTop: 20, flexDirection: 'row', alignItems: 'center',
  },

  numberItem: { flex: 1, alignItems: 'center' },

  numberValue: { fontSize: 25, fontWeight: '800', color: '#208AEF' },

  numberValueAlerta: { color: '#F04438' },

  numberLabel: { marginTop: 3, fontSize: 11, color: '#667085', textAlign: 'center' },

  numberDivider: { width: 1, height: 40, backgroundColor: '#E4E7EC' },

  // Barra de divergencias
  divBar: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },

  divBarZero: { fontSize: 13, fontWeight: '700', color: '#12B76A' },

  divBarAlerta: { fontSize: 13, fontWeight: '700', color: '#B54708' },

  sectionTitle: {
    marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: '800', color: '#667085',
  },

  emptyCard: { padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF' },

  emptyText: { fontSize: 13, color: '#667085', textAlign: 'center' },

  productCard: { marginBottom: 10, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden' },

  productMain: { padding: 12, flexDirection: 'row', alignItems: 'center' },

  productCodeBox: {
    minWidth: 64, paddingVertical: 8, paddingHorizontal: 6,
    borderRadius: 8, alignItems: 'center',
  },

  productCode: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  productInfo: { flex: 1, marginLeft: 10 },

  productName: { fontSize: 13, fontWeight: '700', color: '#18212F' },

  productModelo: { fontSize: 11, fontWeight: '600', color: '#475467', marginTop: 2 },

  productMetaRow: {
    marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6,
  },

  quantityBox: {
    minWidth: 52, alignItems: 'center', justifyContent: 'center', paddingLeft: 8,
  },

  quantityValue: { fontSize: 22, fontWeight: '900', color: '#18212F' },

  quantityLabel: { fontSize: 8, fontWeight: '700', color: '#98A2B3', marginTop: 1 },

  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  badgeSmallText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },

  editHint: { marginTop: 4, fontSize: 9, color: '#98A2B3' },

  legadoBadge: {
    marginTop: 4, fontSize: 9, fontWeight: '700',
    color: '#B54708', backgroundColor: '#FFFAEB',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start',
  },

  acPartesRow: { marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  acParteBadge: {
    fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },

  acParteBadgeTipo: { backgroundColor: '#EFF8FF', color: '#175CD3' },

  parHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, marginBottom: 4, paddingHorizontal: 4, gap: 6,
  },

  parHeaderText: { fontSize: 9, fontWeight: '800', color: '#175CD3', letterSpacing: 0.6 },

  parHeaderCodigo: { fontSize: 9, fontWeight: '700', color: '#344054', flex: 1 },

  parHeaderBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#ECFDF3',
  },

  parHeaderBadgeText: { fontSize: 8, fontWeight: '800', color: '#027A48' },

  parHeaderIncompleto: { fontSize: 9, fontWeight: '600', color: '#98A2B3', fontStyle: 'italic' },

  productCardPar: { marginLeft: 8, borderLeftWidth: 3 },

  acParteBadgeEva: {
    backgroundColor: '#EFF8FF', color: '#175CD3',
    fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    alignSelf: 'flex-start', marginTop: 3,
  },

  acParteBadgeCond: {
    backgroundColor: '#F4F3FF', color: '#5925DC',
    fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    alignSelf: 'flex-start', marginTop: 3,
  },

  // Botão único de divergência
  btnDiv: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },

  btnDivAtivo: { backgroundColor: '#F04438' },

  btnDivTexto: { fontSize: 12, fontWeight: '700', color: '#98A2B3' },

  btnDivTextoAtivo: { color: '#FFFFFF' },

  // Ações
  confirmButton: {
    height: 58, marginTop: 14, borderRadius: 16, backgroundColor: '#12B76A',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },

  buttonDisabled: { opacity: 0.7 },

  confirmIcon: { fontSize: 21, color: '#FFFFFF', marginRight: 10 },

  confirmText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  newButton: {
    height: 54, marginTop: 10, marginBottom: 8, borderRadius: 16,
    borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center',
  },

  newText: { fontSize: 14, fontWeight: '700', color: '#344054' },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },

  // Modal de confirmação
  confirmCard: {
    width: '100%', maxWidth: 420, padding: 24,
    borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center',
  },

  confirmCardIcon: { fontSize: 34, marginBottom: 8 },

  confirmCardTitle: {
    fontSize: 18, fontWeight: '900', color: '#18212F', textAlign: 'center',
  },

  confirmResumoRow: {
    marginTop: 16, width: '100%', flexDirection: 'row', gap: 10,
  },

  confirmResumoItem: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },

  confirmResumoTotal: { backgroundColor: '#F2F4F7' },

  confirmResumoOk: { backgroundColor: '#ECFDF3' },

  confirmResumoDiv: { backgroundColor: '#FFF1F0' },

  confirmResumoNum: { fontSize: 24, fontWeight: '800', color: '#18212F' },

  confirmResumoLabel: { fontSize: 11, fontWeight: '700', color: '#667085', marginTop: 2 },

  confirmDivLista: {
    marginTop: 14, width: '100%',
    borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA',
    backgroundColor: '#FFF1F0', padding: 12, gap: 6,
  },

  confirmDivListaTitulo: { fontSize: 11, fontWeight: '800', color: '#B42318', marginBottom: 4 },

  confirmDivItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },

  confirmDivCodigo: {
    fontSize: 11, fontWeight: '800', color: '#344054', minWidth: 60,
  },

  confirmDivNome: { flex: 1, fontSize: 11, color: '#344054' },

  confirmDivQtd: { fontSize: 11, color: '#667085' },

  confirmDivMais: { fontSize: 11, color: '#98A2B3', textAlign: 'center', marginTop: 2 },

  confirmFinalButton: {
    width: '100%', minHeight: 52, marginTop: 18,
    borderRadius: 13, backgroundColor: '#12B76A',
    alignItems: 'center', justifyContent: 'center',
  },

  confirmFinalButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  confirmCancelButton: {
    width: '100%', minHeight: 48, marginTop: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  confirmCancelButtonText: { fontSize: 14, fontWeight: '700', color: '#667085' },

  // ---- Modal rápido de quantidade ----
  qtdCard: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },

  qtdCardCodigo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#208AEF',
  },

  qtdCardNome: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#18212F',
    textAlign: 'center',
  },

  qtdControle: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },

  qtdBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtdBtnTexto: {
    fontSize: 28,
    fontWeight: '700',
    color: '#18212F',
    lineHeight: 32,
  },

  qtdNumero: {
    fontSize: 48,
    fontWeight: '900',
    color: '#18212F',
    minWidth: 72,
    textAlign: 'center',
  },

  qtdAvisoRemover: {
    marginTop: 10,
    fontSize: 11,
    color: '#F04438',
    fontWeight: '600',
  },

  qtdSalvar: {
    width: '100%',
    minHeight: 50,
    marginTop: 24,
    borderRadius: 13,
    backgroundColor: '#12B76A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtdSalvarTexto: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  qtdCancelar: {
    width: '100%',
    minHeight: 44,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtdCancelarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },

  // ---- Comparação NF ----
  nfContainer: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  nfTitulo: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    fontSize: 11,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.5,
  },

  nfOkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ECFDF3',
  },

  nfOkIcon: { fontSize: 16, color: '#027A48' },

  nfOkTexto: { fontSize: 13, fontWeight: '700', color: '#027A48' },

  nfSecao: {
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
  },

  nfSecaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },

  nfSecaoBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  nfSecaoBadgeFaltante: { backgroundColor: '#FEF3F2' },
  nfSecaoBadgeSobrante: { backgroundColor: '#FFFAEB' },
  nfSecaoBadgeNaoEsp:   { backgroundColor: '#F4F3FF' },

  nfSecaoBadgeText: { fontSize: 11, fontWeight: '800', color: '#344054' },

  nfSecaoTitulo: { flex: 1, fontSize: 13, fontWeight: '700' },

  nfSecaoTituloFaltante: { color: '#B42318' },
  nfSecaoTituloSobrante: { color: '#B54708' },
  nfSecaoTituloNaoEsp:   { color: '#5925DC' },

  nfLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
    gap: 10,
  },

  nfLinhaInfo: { flex: 1 },

  nfLinhaCodigo: { fontSize: 12, fontWeight: '800', color: '#208AEF' },

  nfLinhaNome: { fontSize: 11, color: '#667085', marginTop: 1 },

  nfLinhaQtdTexto: { fontSize: 12, fontWeight: '600', color: '#344054' },

  nfLinhaQtdNeg: { color: '#B42318', fontWeight: '800' },

  nfLinhaQtdPos: { color: '#B54708', fontWeight: '800' },

  nfLinhaQtdNaoEsp: { color: '#5925DC', fontWeight: '700' },
});
