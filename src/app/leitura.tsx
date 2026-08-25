// ============================================================
// LEITURA — RAMSONS CONFERÊNCIA
// ============================================================

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { useAudioPlayer } from 'expo-audio';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  atualizarNomeConferencia,
  atualizarProduto,
  atualizarStatusLeitura,
  buscarPorCodigoBarras,
  cancelarConferencia,
  completarProdutoDesconhecido,
  editarQuantidadeLeitura,
  formatarNumeroConferencia,
  obterConfiguracao,
  obterConferencia,
  obterLeiturasConferencia,
  registrarLeituraConferencia,
  registrarProdutoDesconhecido,
  removerLeituraConferencia,
} from '@/database/database';

import { CORES_STATUS } from '@/constants/cores';
import { ModalEdicaoItem } from '@/components/ModalEdicaoItem';

import type {
  DadosProdutoRapido,
  LeituraConferencia,
  StatusLeitura,
  TipoProduto,
} from '@/models/produto';

// ============================================================
// TEMPO DE BLOQUEIO PARA O MESMO CÓDIGO
// ============================================================

const TEMPO_BLOQUEIO_MESMO_CODIGO_MS_PADRAO = 2500;

// ============================================================
// PANTALLA
// ============================================================


export default function LeituraScreen() {
  const { conferenciaId: conferenciaIdParam } =
    useLocalSearchParams<{ conferenciaId: string }>();

  const conferenciaId = Number(conferenciaIdParam);
  const conferenciaValida =
    Boolean(conferenciaIdParam) && !Number.isNaN(conferenciaId);

  const [permission, requestPermission] =
    useCameraPermissions();

  const [cameraAtiva, setCameraAtiva] =
    useState(false);

  const [produtos, setProdutos] =
    useState<LeituraConferencia[]>([]);

  const [processando, setProcessando] =
    useState(false);

  const [carregandoInicial, setCarregandoInicial] =
    useState(true);

  const [leituraConfirmada, setLeituraConfirmada] =
    useState(false);

  const [feedbackVermelho, setFeedbackVermelho] = useState(false);
  const [feedbackAmarelo, setFeedbackAmarelo] = useState(false);
  const [textoFeedbackAmarelo, setTextoFeedbackAmarelo] = useState('NADA ENCONTRADO');
  const [primeiraScanPendente, setPrimeiraScanPendente] = useState(false);

  const [somAtivado, setSomAtivado] = useState(true);
  const [vibrarAtivado, setVibrarAtivado] = useState(true);

  const [mostrarConfirmacao, setMostrarConfirmacao] =
    useState(false);

  const [mostrarConfirmacaoCancelar, setMostrarConfirmacaoCancelar] =
    useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [itemEditando, setItemEditando] =
    useState<LeituraConferencia | null>(null);

  // Intercepta botão voltar do Android quando o modal de edição está aberto.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (itemEditando) {
          setItemEditando(null);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [itemEditando]),
  );

  // Tempo configurado em Configuracoes (ou o padrao).
  const [tempoBloqueioMs, setTempoBloqueioMs] = useState(
    TEMPO_BLOQUEIO_MESMO_CODIGO_MS_PADRAO,
  );

  const [nomeConferencia, setNomeConferencia] = useState('');
  const [mostrarRenomear, setMostrarRenomear] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  const ultimoCodigoLido =
    useRef<string | null>(null);

  // Confirmação de leitura: exige 2 detecções consecutivas do mesmo
  // código antes de processar. Filtra misreads de movimento rápido.
  const codigoPendente =
    useRef<{ data: string; contagem: number } | null>(null);

  const azulTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modoLeitura, setModoLeitura] = useState<'automatico' | 'manual'>(
    'automatico',
  );
  const [escutandoManual, setEscutandoManual] = useState(false);

  const leituraManualTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const feedbackAmareloTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const somAzul = useAudioPlayer(require('@/assets/sounds/azul.mp3'));
  const somVermelho = useAudioPlayer(
    require('@/assets/sounds/vermelho.mp3'),
  );
  const somAmarelo = useAudioPlayer(
    require('@/assets/sounds/amarelo.mp3'),
  );

  function tocarSom(player: ReturnType<typeof useAudioPlayer>) {
    if (!somAtivado) {
      return;
    }

    player.seekTo(0);
    player.play();
  }

  function vibrarSeAtivado() {
    if (vibrarAtivado) {
      Vibration.vibrate(60);
    }
  }

  useEffect(() => {
    return () => {
      if (azulTimer.current) clearTimeout(azulTimer.current);
      if (leituraManualTimer.current) clearTimeout(leituraManualTimer.current);
      if (feedbackAmareloTimer.current) clearTimeout(feedbackAmareloTimer.current);
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarLeiturasExistentes() {
      if (!conferenciaValida) {
        setCarregandoInicial(false);
        return;
      }

      try {
        const existentes =
          await obterLeiturasConferencia(conferenciaId);

        if (ativo) {
          setProdutos(existentes);
        }
      } catch (error) {
        console.error(
          'Erro ao carregar leituras da conferência:',
          error,
        );
      } finally {
        if (ativo) {
          setCarregandoInicial(false);
        }
      }
    }

    carregarLeiturasExistentes();

    return () => {
      ativo = false;
    };
  }, [conferenciaId, conferenciaValida]);

  // Carrega configurações globais e nome da conferência numa única chamada.
  useEffect(() => {
    let ativo = true;

    async function carregarConfiguracoes() {
      const [velocidade, modo, som, vibrar, conferencia] = await Promise.all([
        obterConfiguracao('tempo_bloqueio_ms', String(TEMPO_BLOQUEIO_MESMO_CODIGO_MS_PADRAO)),
        obterConfiguracao('modo_leitura', 'automatico'),
        obterConfiguracao('som_ativado', 'true'),
        obterConfiguracao('vibrar_ativado', 'true'),
        conferenciaValida ? obterConferencia(conferenciaId) : Promise.resolve(null),
      ]);

      if (!ativo) {
        return;
      }

      setTempoBloqueioMs(Number(velocidade));
      setSomAtivado(som !== 'false');
      setVibrarAtivado(vibrar !== 'false');

      if (modo === 'automatico' || modo === 'manual') {
        setModoLeitura(modo);
      }

      if (conferencia) {
        setNomeConferencia(conferencia.nome);
      }
    }

    carregarConfiguracoes();

    return () => {
      ativo = false;
    };
  }, [conferenciaId, conferenciaValida]);
  async function ativarCamera() {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const resultado =
        await requestPermission();

      if (!resultado.granted) {
        return;
      }
    }

    setCameraAtiva(true);
  }

  async function registrarLeitura(
    codigoBarras: string,
  ) {
    if (processando || !conferenciaValida) {
      return;
    }

    if (ultimoCodigoLido.current === codigoBarras) {
      codigoPendente.current = null;
      setPrimeiraScanPendente(false);
      return;
    }

    ultimoCodigoLido.current = codigoBarras;

    setProcessando(true);

    try {
      const agora = new Date().toISOString();

      let produto = await buscarPorCodigoBarras(codigoBarras);
      let statusNovaLeitura: StatusLeitura = 'normal';

      if (!produto) {
        produto = await registrarProdutoDesconhecido(codigoBarras);
        statusNovaLeitura = 'desconhecido';
      }

      const produtoExistente = produtos.find(
        (item) => item.produto.codigoInterno === produto!.codigoInterno,
      );

      const primeiraLeitura = produtoExistente ? produtoExistente.primeiraLeitura : agora;
      const statusFinal = produtoExistente?.status ?? statusNovaLeitura;

      await registrarLeituraConferencia(
        conferenciaId,
        produto.codigoInterno,
        1,
        primeiraLeitura,
        agora,
        statusFinal,
      );

      setProdutos((listaAtual) => {
        const indice = listaAtual.findIndex(
          (item) => item.produto.codigoInterno === produto!.codigoInterno,
        );

        if (indice >= 0) {
          const novaLista = [...listaAtual];
          const itemAtual = novaLista[indice];
          novaLista[indice] = {
            ...itemAtual,
            quantidade: itemAtual.quantidade + 1,
            ultimaLeitura: agora,
          };
          return novaLista;
        }

        const novoItem: LeituraConferencia = {
          id: -1,
          produto: produto!,
          quantidade: 1,
          primeiraLeitura,
          ultimaLeitura: agora,
          status: statusFinal,
          statusRevisao: 'pendente',
        };

        return [novoItem, ...listaAtual];
      });

      const ehDesconhecido = statusFinal === 'desconhecido';

      if (ehDesconhecido) {
        tocarSom(somVermelho);
        setFeedbackVermelho(true);
      } else {
        tocarSom(somAzul);
        setLeituraConfirmada(true);
      }

      vibrarSeAtivado();

      if (azulTimer.current) clearTimeout(azulTimer.current);
      azulTimer.current = setTimeout(() => {
        setLeituraConfirmada(false);
        setFeedbackVermelho(false);
      }, 450);

      setTimeout(() => {
        ultimoCodigoLido.current = null;
      }, tempoBloqueioMs);
    } catch (error) {
      console.error('Erro ao registrar leitura:', error);
      ultimoCodigoLido.current = null;
    } finally {
      setProcessando(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (!data) return;

    // Modo manual: aceita na primeira leitura (usuário já confirmou).
    if (modoLeitura === 'manual') {
      setEscutandoManual(false);

      if (leituraManualTimer.current) {
        clearTimeout(leituraManualTimer.current);
        leituraManualTimer.current = null;
      }

      codigoPendente.current = null;
      void registrarLeitura(data);
      return;
    }

    // Modo automático: exige 2 leituras consecutivas do mesmo código.
    const pendente = codigoPendente.current;

    if (pendente && pendente.data === data) {
      const novaContagem = pendente.contagem + 1;

      if (novaContagem >= 2) {
        codigoPendente.current = null;
        setPrimeiraScanPendente(false);
        void registrarLeitura(data);
      } else {
        codigoPendente.current = { data, contagem: novaContagem };
      }
    } else {
      codigoPendente.current = { data, contagem: 1 };
      setPrimeiraScanPendente(true);
    }
  }

  function handlePressionarLer() {
    if (escutandoManual || processando) {
      return;
    }

    setEscutandoManual(true);

    leituraManualTimer.current = setTimeout(() => {
      setEscutandoManual(false);
      leituraManualTimer.current = null;

      tocarSom(somAmarelo);
      vibrarSeAtivado();
      setTextoFeedbackAmarelo('NADA ENCONTRADO');
      setFeedbackAmarelo(true);

      feedbackAmareloTimer.current = setTimeout(() => {
        setFeedbackAmarelo(false);
        feedbackAmareloTimer.current = null;
      }, 450);
    }, 1500);
  }

  const totalUnidades =
    produtos.reduce(
      (total, item) =>
        total + item.quantidade,
      0,
    );

function abrirEdicao(item: LeituraConferencia) {
    setItemEditando(item);
  }

  function fecharEdicao() {
    setItemEditando(null);
  }

  async function salvarQuantidade(novaQuantidade: number) {
    if (!itemEditando || !conferenciaValida) {
      return;
    }

    const quantidadeValida = Math.max(0, Math.floor(novaQuantidade));

    try {
      if (quantidadeValida === 0) {
        await removerLeituraConferencia(
          conferenciaId,
          itemEditando.produto.codigoInterno,
        );

        setProdutos((lista) =>
          lista.filter(
            (item) =>
              item.produto.codigoInterno !==
              itemEditando.produto.codigoInterno,
          ),
        );
      } else {
        await editarQuantidadeLeitura(
          conferenciaId,
          itemEditando.produto.codigoInterno,
          quantidadeValida,
        );

        setProdutos((lista) =>
          lista.map((item) =>
            item.produto.codigoInterno ===
            itemEditando.produto.codigoInterno
              ? { ...item, quantidade: quantidadeValida }
              : item,
          ),
        );
      }

      fecharEdicao();
    } catch (error) {
      console.error('Erro ao editar quantidade:', error);
    }
  }

  async function removerItem() {
    if (!itemEditando || !conferenciaValida) {
      return;
    }

    try {
      await removerLeituraConferencia(
        conferenciaId,
        itemEditando.produto.codigoInterno,
      );

      setProdutos((lista) =>
        lista.filter(
          (item) =>
            item.produto.codigoInterno !==
            itemEditando.produto.codigoInterno,
        ),
      );

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

    setProdutos((lista) =>
      lista.map((item) =>
        item.produto.codigoInterno === itemEditando.produto.codigoInterno
          ? {
              ...item,
              status: 'novo',
              produto: {
                ...item.produto,
                codigoInterno: novoCodigoInterno,
                nome: dados.nome,
                marca: dados.marca,
                categoria: dados.categoria,
                modelo: dados.modelo,
                descricao: dados.descricao,
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

      setProdutos((lista) =>
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
    nome: string;
    marca?: string;
    categoria?: string;
    modelo?: string;
    descricao?: string;
  }): Promise<string | null> {
    if (!itemEditando) return null;

    try {
      await atualizarProduto(
        { ...itemEditando.produto, ...dados },
        itemEditando.produto.codigoInterno,
      );

      setProdutos((lista) =>
        lista.map((item) =>
          item.produto.codigoInterno === itemEditando.produto.codigoInterno
            ? { ...item, produto: { ...item.produto, ...dados } }
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
  ): Promise<string | null> {
    if (!itemEditando) return null;

    try {
      await atualizarProduto(
        { ...itemEditando.produto, codigoPar },
        itemEditando.produto.codigoInterno,
      );

      const socio = produtos.find(
        (it) => it.produto.codigoInterno === codigoInternoSocio,
      );
      if (socio) {
        await atualizarProduto(
          { ...socio.produto, codigoPar },
          socio.produto.codigoInterno,
        );
      }

      setProdutos((lista) =>
        lista.map((it) =>
          it.produto.codigoInterno === itemEditando.produto.codigoInterno ||
          it.produto.codigoInterno === codigoInternoSocio
            ? { ...it, produto: { ...it.produto, codigoPar } }
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

      const socio = produtos.find(
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

      setProdutos((lista) =>
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

  function abrirRenomear() {
    setNovoNome(nomeConferencia);
    setMostrarRenomear(true);
  }

  async function salvarNome() {
    if (salvandoNome) {
      return;
    }

    setSalvandoNome(true);

    try {
      await atualizarNomeConferencia(conferenciaId, novoNome);

      const nomeFinal =
        novoNome.trim() ||
        formatarNumeroConferencia(conferenciaId);

      setNomeConferencia(nomeFinal);
      setMostrarRenomear(false);
    } catch (error) {
      console.error('Erro ao renomear conferência:', error);
    } finally {
      setSalvandoNome(false);
    }
  }

  function handleFinalizar() {
    if (!conferenciaValida) {
      return;
    }

    setMostrarConfirmacao(false);

    router.push({
      pathname: '/resultado',
      params: { conferenciaId: String(conferenciaId) },
    });
  }

  async function handleCancelar() {
    if (!conferenciaValida || cancelando) {
      return;
    }

    setCancelando(true);

    try {
      await cancelarConferencia(conferenciaId);
      router.replace('/');
    } catch (error) {
      console.error('Erro ao cancelar conferência:', error);
      setCancelando(false);
    }
  }

  const itensOrganizados = useMemo(() => {
    const grupos: Record<string, LeituraConferencia[]> = {};
    const individuais: LeituraConferencia[] = [];

    for (const item of produtos) {
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
  }, [produtos]);

  if (!conferenciaValida) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>⚠️</Text>

          <Text style={styles.permissionTitle}>
            Conferência inválida
          </Text>

          <Text style={styles.permissionText}>
            Não foi possível identificar esta
            conferência. Volte e inicie uma
            nova conferência.
          </Text>

          <Pressable
            style={styles.permissionButton}
            onPress={() => router.back()}
          >
            <Text style={styles.permissionButtonText}>
              VOLTAR
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (carregandoInicial) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" />

          <Text style={styles.permissionText}>
            Carregando conferência...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" />

          <Text style={styles.permissionText}>
            Verificando câmera...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>

          <Text style={styles.permissionTitle}>
            Câmera necessária
          </Text>

          <Text style={styles.permissionText}>
            Permita o acesso à câmera para
            ler os códigos de barras dos
            produtos.
          </Text>

          <Pressable
            style={styles.permissionButton}
            onPress={() => {
              void requestPermission();
            }}
          >
            <Text style={styles.permissionButtonText}>
              PERMITIR CÂMERA
            </Text>
          </Pressable>

          <Pressable
            style={styles.permissionBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.permissionBackText}>
              VOLTAR
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Pressable
          style={styles.headerCenter}
          onPress={abrirRenomear}
        >
          <Text style={styles.headerTitle}>
            {nomeConferencia || formatarNumeroConferencia(conferenciaId)}
          </Text>

          <Text style={styles.headerSubtitle}>
            Conferência a cegas
          </Text>
        </Pressable>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.cameraContainer}>
        {cameraAtiva ? (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={
                processando
                  ? undefined
                  : modoLeitura === 'manual' && !escutandoManual
                  ? undefined
                  : handleBarcodeScanned
              }
              barcodeScannerSettings={{
                barcodeTypes: [
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                ],
              }}
            />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </>
        ) : (
          <Pressable
            style={styles.startScanner}
            onPress={() => {
              void ativarCamera();
            }}
          >
            <Text style={styles.startScannerIcon}>📷</Text>
            <Text style={styles.startScannerTitle}>
              INICIAR LEITURA
            </Text>
            <Text style={styles.startScannerSubtitle}>
              Toque para abrir a câmera
            </Text>
          </Pressable>
        )}
      </View>

      {cameraAtiva && (
        modoLeitura === 'manual' ? (
          <Pressable
            style={[
              styles.lerButton,
              escutandoManual && styles.lerButtonAtivo,
            ]}
            onPress={handlePressionarLer}
            disabled={escutandoManual}
          >
            <Text style={styles.lerButtonText}>
              {escutandoManual ? 'LENDO...' : 'TOCAR PARA LER'}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.cameraHint, primeiraScanPendente && styles.cameraHintPendente]}>
            <Text style={[styles.cameraHintText, primeiraScanPendente && styles.cameraHintTextPendente]}>
              {primeiraScanPendente ? 'LEIA NOVAMENTE' : 'Aponte para o código de barras'}
            </Text>
          </View>
        )
      )}

      {processando && (
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" />
          <Text style={styles.statusText}>
            Consultando produto...
          </Text>
        </View>
      )}


      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>PRODUTOS CONFERIDOS</Text>
          <Text style={styles.listCount}>{produtos.length}</Text>
        </View>

        <ScrollView
          style={styles.productList}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.productListContent}
        >
          {produtos.length === 0 ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>Nenhum produto lido</Text>
              <Text style={styles.emptyText}>
                Leia um código de barras para
                adicionar o produto à conferência.
              </Text>
            </View>
          ) : (
            <>
              {/* Pares agrupados */}
              {Object.entries(itensOrganizados.grupos).map(([codigoPar, items]) => {
                const ambosPresentes = items.length === 2;
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
                      return (
                        <Pressable
                          key={item.produto.codigoInterno}
                          style={[styles.productCard, styles.productCardPar, { borderColor: cor.borda, backgroundColor: cor.fundo }]}
                          onPress={() => abrirEdicao(item)}
                        >
                          <View style={styles.productInfo}>
                            <View style={styles.productTopRow}>
                              <Text style={[styles.internalCodeLarge, { color: cor.texto }]}>
                                {item.produto.codigoInterno}
                              </Text>
                              <View style={[styles.badgeSmall, { backgroundColor: cor.borda }]}>
                                <Text style={styles.badgeSmallText}>{cor.etiqueta}</Text>
                              </View>
                            </View>
                            <Text style={styles.productNameList} numberOfLines={1}>{item.produto.nome}</Text>
                            <Text style={[styles.acParteBadge, item.produto.tipoProduto === 'evaporadora' ? styles.acParteBadgeEva : styles.acParteBadgeCond]}>
                              {item.produto.tipoProduto === 'evaporadora' ? '❄ Evaporadora' : '❄ Condensadora'}
                            </Text>
                          </View>
                          <View style={styles.quantityBox}>
                            <Text style={styles.quantityLabel}>QTD</Text>
                            <Text style={styles.quantityValue}>{item.quantidade}</Text>
                            <Text style={styles.editHint}>toque p/ editar</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}

              {/* Individuais */}
              {itensOrganizados.individuais.map((item) => {
                const cor = CORES_STATUS[item.status];
                return (
                  <Pressable
                    key={item.produto.codigoInterno}
                    style={[
                      styles.productCard,
                      { borderColor: cor.borda, backgroundColor: cor.fundo },
                    ]}
                    onPress={() => abrirEdicao(item)}
                  >
                    <View style={styles.productInfo}>
                      <View style={styles.productTopRow}>
                        <Text
                          style={[
                            styles.internalCodeLarge,
                            { color: cor.texto },
                          ]}
                        >
                          {item.produto.codigoInterno}
                        </Text>

                        <View
                          style={[
                            styles.badgeSmall,
                            { backgroundColor: cor.borda },
                          ]}
                        >
                          <Text style={styles.badgeSmallText}>
                            {cor.etiqueta}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={styles.productNameList}
                        numberOfLines={2}
                      >
                        {item.produto.nome}
                      </Text>

                      {item.produto.tipoProduto !== 'normal' ? (
                        <View style={styles.acPartesRow}>
                          <Text style={[styles.acParteBadge, styles.acParteBadgeTipo]}>
                            {item.produto.tipoProduto === 'evaporadora'
                              ? '❄ Evaporadora'
                              : '❄ Condensadora'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.productBarcode}>
                          {item.produto.codigoBarras || 'sem código de barras'}
                        </Text>
                      )}
                    </View>

                    <View style={styles.quantityBox}>
                      <Text style={styles.quantityLabel}>QTD</Text>
                      <Text style={styles.quantityValue}>
                        {item.quantidade}
                      </Text>
                      <Text style={styles.editHint}>toque p/ editar</Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>

      <Pressable
        style={styles.finishButton}
        onPress={() => setMostrarConfirmacao(true)}
      >
        <Text style={styles.finishIcon}>✓</Text>
        <Text style={styles.finishText}>FINALIZAR CONFERÊNCIA</Text>
      </Pressable>


      <Pressable
        style={styles.cancelConferenciaButton}
        onPress={() => setMostrarConfirmacaoCancelar(true)}
      >
        <Text style={styles.cancelConferenciaText}>
          Cancelar conferência
        </Text>
      </Pressable>
      {leituraConfirmada && (
        <View pointerEvents="none" style={styles.blueFeedback}>
          <Text style={styles.blueFeedbackIcon}>✓</Text>
          <Text style={styles.blueFeedbackText}>PRODUTO LIDO</Text>
        </View>
      )}

      {feedbackVermelho && (
        <View pointerEvents="none" style={styles.redFeedback}>
          <Text style={styles.blueFeedbackIcon}>⚠️</Text>
          <Text style={styles.blueFeedbackText}>NÃO CADASTRADO</Text>
        </View>
      )}

      {feedbackAmarelo && (
        <View pointerEvents="none" style={styles.yellowFeedback}>
          <Text style={styles.yellowFeedbackIcon}>?</Text>
          <Text style={styles.yellowFeedbackText}>{textoFeedbackAmarelo}</Text>
        </View>
      )}

{itemEditando && (
        <ModalEdicaoItem
          item={itemEditando}
          onFechar={fecharEdicao}
          onSalvarQuantidade={salvarQuantidade}
          onRemover={removerItem}
          onSalvarProdutoNovo={salvarComoProdutoNovo}
          onAtualizarTipo={atualizarTipo}
          onSalvarDadosProduto={salvarDadosProduto}
          itensConferencia={produtos}
          onParear={handleParear}
          onDesparear={handleDesparear}
        />
      )}

      {mostrarRenomear && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>✏️</Text>

            <Text style={styles.confirmTitle}>
              RENOMEAR CONFERÊNCIA
            </Text>

            <TextInput
              style={styles.editInput}
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome da conferência"
              placeholderTextColor="#98A2B3"
              maxLength={60}
              editable={!salvandoNome}
            />

            <Pressable
              style={styles.continueButton}
              onPress={() => {
                void salvarNome();
              }}
              disabled={salvandoNome}
            >
              {salvandoNome ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>
                  SALVAR
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.editCancelButton}
              onPress={() => setMostrarRenomear(false)}
              disabled={salvandoNome}
            >
              <Text style={styles.editCancelButtonText}>
                CANCELAR
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {mostrarConfirmacaoCancelar && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>⚠️</Text>

            <Text style={styles.confirmTitle}>
              CANCELAR CONFERÊNCIA?
            </Text>

            <Text style={styles.confirmText}>
              Esta conferência será cancelada e não poderá
              ser continuada. As leituras já feitas ficam
              guardadas e podem ser consultadas no
              Histórico.
            </Text>

            <Pressable
              style={styles.editRemoveButton}
              onPress={() => {
                void handleCancelar();
              }}
              disabled={cancelando}
            >
              {cancelando ? (
                <ActivityIndicator size="small" color="#F04438" />
              ) : (
                <Text style={styles.editRemoveButtonText}>
                  SIM, CANCELAR CONFERÊNCIA
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.editCancelButton}
              onPress={() => setMostrarConfirmacaoCancelar(false)}
              disabled={cancelando}
            >
              <Text style={styles.editCancelButtonText}>
                VOLTAR
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {mostrarConfirmacao && (
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>📋</Text>

            <Text style={styles.confirmTitle}>
              REVISAR E FINALIZAR
            </Text>

            <Text style={styles.confirmText}>
              Você será levado para a tela de
              revisão, onde poderá conferir e
              corrigir antes de finalizar de vez.
            </Text>

            <Text style={styles.confirmWarning}>
              Foram lidos {produtos.length}{' '}
              produtos e {totalUnidades}{' '}
              unidades.
            </Text>

            <Pressable
              style={styles.continueButton}
              onPress={() => setMostrarConfirmacao(false)}
            >
              <Text style={styles.continueButtonText}>
                CONTINUAR LENDO
              </Text>
            </Pressable>

            <Pressable
              style={styles.confirmFinishButton}
              onPress={handleFinalizar}
            >
              <Text style={styles.confirmFinishText}>
                IR PARA REVISÃO
              </Text>
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

  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backText: {
    fontSize: 38,
    lineHeight: 38,
    color: '#18212F',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#18212F',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#667085',
  },

  headerSpacer: {
    width: 44,
  },

  cameraContainer: {
    height: 220,
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#101828',
  },

  camera: {
    flex: 1,
  },

  startScanner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },

  startScannerIcon: {
    fontSize: 32,
  },

  startScannerTitle: {
    marginTop: 7,
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  startScannerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#EAF4FF',
  },

  cornerTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 4,
  },

  cornerTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 4,
  },

  cornerBottomLeft: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },

  cornerBottomRight: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 4,
  },

  cameraHint: {
    marginHorizontal: 18,
    marginTop: 6,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
  },

  cameraHintPendente: {
    backgroundColor: '#FFFAEB',
    borderColor: '#F79009',
  },

  cameraHintTextPendente: {
    color: '#B54708',
    fontWeight: '800',
  },

  statusBox: {
    minHeight: 36,
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  statusText: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
  },

  summary: {
    marginHorizontal: 18,
    marginTop: 8,
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#667085',
    textAlign: 'center',
  },

  summaryValue: {
    marginTop: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E4E7EC',
  },

  listContainer: {
    flex: 1,
    marginHorizontal: 18,
    marginTop: 8,
  },

  listHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  listTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.8,
  },

  listCount: {
    minWidth: 25,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#EAF4FF',
    color: '#208AEF',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },

  productList: {
    flex: 1,
  },

  productListContent: {
    paddingTop: 4,
    paddingBottom: 6,
    gap: 7,
  },

  emptyList: {
    minHeight: 100,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },

  emptyIcon: {
    fontSize: 25,
  },

  emptyTitle: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '800',
    color: '#18212F',
  },

  emptyText: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: '#667085',
    textAlign: 'center',
  },

  productCard: {
    minHeight: 70,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },

  productInfo: {
    flex: 1,
    paddingRight: 8,
  },

  productTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  internalCodeLarge: {
    fontSize: 12,
    fontWeight: '900',
  },

  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  badgeSmallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  productNameList: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: '#18212F',
  },

  productBarcode: {
    marginTop: 2,
    fontSize: 9,
    color: '#98A2B3',
  },

  acPartesRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 6,
  },

  acParteBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  acParteBadgeOk: {
    backgroundColor: '#ECFDF3',
    color: '#027A48',
  },

  acParteBadgePend: {
    backgroundColor: '#F2F4F7',
    color: '#667085',
  },

  acParteBadgeTipo: {
    backgroundColor: '#EFF8FF',
    color: '#175CD3',
  },

  parHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
    gap: 6,
  },

  parHeaderText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#175CD3',
    letterSpacing: 0.6,
  },

  parHeaderCodigo: {
    fontSize: 9,
    fontWeight: '700',
    color: '#344054',
    flex: 1,
  },

  parHeaderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#ECFDF3',
  },

  parHeaderBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#027A48',
  },

  parHeaderIncompleto: {
    fontSize: 9,
    fontWeight: '600',
    color: '#98A2B3',
    fontStyle: 'italic',
  },

  productCardPar: {
    marginLeft: 8,
    borderLeftWidth: 3,
  },

  acParteBadgeEva: {
    backgroundColor: '#EFF8FF',
    color: '#175CD3',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },

  acParteBadgeCond: {
    backgroundColor: '#F4F3FF',
    color: '#5925DC',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },

  quantityBox: {
    minWidth: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quantityLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#98A2B3',
  },

  quantityValue: {
    marginTop: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#18212F',
  },

  editHint: {
    marginTop: 2,
    fontSize: 7,
    color: '#98A2B3',
  },

  finishButton: {
    minHeight: 50,
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 13,
    backgroundColor: '#18212F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishIcon: {
    marginRight: 8,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '900',
  },

  finishText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  blueFeedback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(32, 138, 239, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  blueFeedbackIcon: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  blueFeedbackText: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#FFFFFF',
  },

  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  permissionIcon: {
    fontSize: 48,
  },

  permissionTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  permissionText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
    textAlign: 'center',
  },

  permissionButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 24,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  permissionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  permissionBackButton: {
    marginTop: 12,
    padding: 12,
  },

  permissionBackText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#667085',
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
    fontSize: 19,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  confirmText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: '#475467',
    textAlign: 'center',
  },

  confirmWarning: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#667085',
    textAlign: 'center',
  },

  continueButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 22,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  confirmFinishButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmFinishText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18212F',
  },

  editCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  barcodeBox: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F2F4F7',
    marginBottom: 4,
    alignItems: 'center',
  },

  barcodeBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#98A2B3',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  barcodeBoxValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#344054',
  },

  editRow: {
    flexDirection: 'row',
    gap: 10,
  },

  editRowItem: {
    flex: 1,
  },

  editTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '900',
    color: '#18212F',
    textAlign: 'center',
  },

  editSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#667085',
    textAlign: 'center',
  },

  editLabel: {
    marginTop: 16,
    fontSize: 10,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  editInput: {
    marginTop: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#18212F',
  },

  editSaveButton: {
    height: 50,
    marginTop: 18,
    borderRadius: 13,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editButtonDisabled: {
    opacity: 0.5,
  },

  editSaveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  editDivider: {
    height: 1,
    backgroundColor: '#EEF1F4',
    marginTop: 20,
  },

  editRemoveButton: {
    height: 48,
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editRemoveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F04438',
  },

  editCancelButton: {
    height: 46,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },

  cancelConferenciaButton: {
    marginTop: 4,
    marginHorizontal: 18,
    marginBottom: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },

  cancelConferenciaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#98A2B3',
  },

  lerButton: {
    marginHorizontal: 18,
    marginTop: 6,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lerButtonAtivo: {
    backgroundColor: '#1570C8',
  },

  lerButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },

  redFeedback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(240, 68, 56, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  yellowFeedback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(242, 201, 76, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  yellowFeedbackIcon: {
    fontSize: 72,
    fontWeight: '900',
    color: '#5C4600',
  },

  yellowFeedbackText: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#5C4600',
  },
});


