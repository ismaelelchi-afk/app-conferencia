// ============================================================
// LEITURA — RAMSONS CONFERÊNCIA
// ============================================================

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { useAudioPlayer } from 'expo-audio';

import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';

import {
  buscarPorCodigoBarras,
  completarProdutoDesconhecido,
  editarQuantidadeLeitura,
  obterLeiturasConferencia,
  registrarLeituraConferencia,
  registrarProdutoDesconhecido,
  removerLeituraConferencia,
  atualizarStatusLeitura,
  obterConfiguracao,
  atualizarNomeConferencia,
  obterConferencia,
  cancelarConferencia,
} from '@/database/database';

import type {
  DadosProdutoRapido,
  LeituraConferencia,
  StatusLeitura,
} from '@/models/produto';

// ============================================================
// FORMATAR NÚMERO DE CONFERÊNCIA PARA EXIBIÇÃO
// ============================================================

function formatarNumeroConferencia(id: number): string {
  return `#${String(id).padStart(6, '0')}`;
}

// ============================================================
// TEMPO DE BLOQUEIO PARA O MESMO CÓDIGO
// ============================================================

const TEMPO_BLOQUEIO_MESMO_CODIGO_MS_PADRAO = 2500;

// ============================================================
// CORES POR STATUS DE LEITURA
// ============================================================

const CORES_STATUS: Record<
  StatusLeitura,
  { fundo: string; borda: string; texto: string; etiqueta: string }
> = {
  normal: {
    fundo: '#EAF4FF',
    borda: '#208AEF',
    texto: '#175CD3',
    etiqueta: 'OK',
  },
  novo: {
    fundo: '#FFFBEA',
    borda: '#F2C94C',
    texto: '#9A7B00',
    etiqueta: 'NOVO',
  },
  desconhecido: {
    fundo: '#FFF1F0',
    borda: '#F04438',
    texto: '#B42318',
    etiqueta: 'DESCONHECIDO',
  },
};

// ============================================================
// PANTALLA
// ============================================================

// ============================================================
// ZONA REAL DE DETECÇÃO
// Coincide aproximadamente com o quadrado desenhado na câmera.
// Se o código detectado cair fora, é ignorado. Se o telefone
// não informar as coordenadas (alguns Android antigos), aceita
// a leitura mesmo assim — melhor um falso positivo raro do que
// parar de detectar códigos válidos.
// ============================================================

const ZONA_ESCANEAVEL = { x: 0.2, y: 0.15, width: 0.6, height: 0.7 };

function estaNaZona(
  cornerPoints?: { x: number; y: number }[],
): boolean {
  if (!cornerPoints || cornerPoints.length === 0) {
    return true;
  }

  return cornerPoints.every((ponto) => {
    const dentroX =
      ponto.x >= ZONA_ESCANEAVEL.x &&
      ponto.x <= ZONA_ESCANEAVEL.x + ZONA_ESCANEAVEL.width;
    const dentroY =
      ponto.y >= ZONA_ESCANEAVEL.y &&
      ponto.y <= ZONA_ESCANEAVEL.y + ZONA_ESCANEAVEL.height;

    return dentroX && dentroY;
  });
}

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

  const [ultimoProduto, setUltimoProduto] =
    useState<LeituraConferencia | null>(null);

  const [processando, setProcessando] =
    useState(false);

  const [carregandoInicial, setCarregandoInicial] =
    useState(true);

  const [leituraConfirmada, setLeituraConfirmada] =
    useState(false);

  const [feedbackVermelho, setFeedbackVermelho] = useState(false);
  const [feedbackAmarelo, setFeedbackAmarelo] = useState(false);

  const [somAtivado, setSomAtivado] = useState(true);
  const [vibrarAtivado, setVibrarAtivado] = useState(true);

  const [mostrarConfirmacao, setMostrarConfirmacao] =
    useState(false);

  const [mostrarConfirmacaoCancelar, setMostrarConfirmacaoCancelar] =
    useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [itemEditando, setItemEditando] =
    useState<LeituraConferencia | null>(null);

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

  const azulTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modoLeitura, setModoLeitura] = useState<'automatico' | 'manual'>(
    'automatico',
  );
  const [escutandoManual, setEscutandoManual] = useState(false);

  const leituraManualTimer =
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
      if (azulTimer.current) {
        clearTimeout(azulTimer.current);
      }
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

  useEffect(() => {
    let ativo = true;

    async function carregarVelocidade() {
      const valor = await obterConfiguracao(
        'tempo_bloqueio_ms',
        String(TEMPO_BLOQUEIO_MESMO_CODIGO_MS_PADRAO),
      );

      if (ativo) {
        setTempoBloqueioMs(Number(valor));
      }
    }

    carregarVelocidade();

    return () => {
      ativo = false;
    };
  }, []);


  useEffect(() => {
    let ativo = true;

    async function carregarNomeConferencia() {
      if (!conferenciaValida) {
        return;
      }

      const conferencia = await obterConferencia(conferenciaId);

      if (ativo && conferencia) {
        setNomeConferencia(conferencia.nome);
      }
    }

    carregarNomeConferencia();

    return () => {
      ativo = false;
    };
  }, [conferenciaId, conferenciaValida]);


  useEffect(() => {
    let ativo = true;

    async function carregarModoLeitura() {
      const valor = await obterConfiguracao('modo_leitura', 'automatico');

      if (ativo && (valor === 'automatico' || valor === 'manual')) {
        setModoLeitura(valor);
      }
    }

    carregarModoLeitura();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarSomVibracao() {
      const [som, vibrar] = await Promise.all([
        obterConfiguracao('som_ativado', 'true'),
        obterConfiguracao('vibrar_ativado', 'true'),
      ]);

      if (ativo) {
        setSomAtivado(som === 'true');
        setVibrarAtivado(vibrar === 'true');
      }
    }

    carregarSomVibracao();

    return () => {
      ativo = false;
    };
  }, []);
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

    if (
      ultimoCodigoLido.current === codigoBarras
    ) {
      return;
    }

    ultimoCodigoLido.current = codigoBarras;

    setProcessando(true);

    try {
      let produto = await buscarPorCodigoBarras(codigoBarras);
      let statusNovaLeitura: StatusLeitura = 'normal';

      if (!produto) {
        produto = await registrarProdutoDesconhecido(codigoBarras);
        statusNovaLeitura = 'desconhecido';
      }

      const agora = new Date().toISOString();

      const produtoExistente = produtos.find(
        (item) =>
          item.produto.codigoInterno === produto!.codigoInterno,
      );

      const primeiraLeitura =
        produtoExistente
          ? produtoExistente.primeiraLeitura
          : agora;

      const statusFinal =
        produtoExistente?.status ?? statusNovaLeitura;

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
          (item) =>
            item.produto.codigoInterno === produto!.codigoInterno,
        );

        if (indice >= 0) {
          const novaLista = [...listaAtual];
          const itemAtual = novaLista[indice];

          const itemAtualizado: LeituraConferencia = {
            ...itemAtual,
            quantidade: itemAtual.quantidade + 1,
            ultimaLeitura: agora,
          };

          novaLista[indice] = itemAtualizado;
          setUltimoProduto(itemAtualizado);

          return novaLista;
        }

        const novoItem: LeituraConferencia = {
          id: -1,
          produto: produto!,
          quantidade: 1,
          primeiraLeitura,
          ultimaLeitura: agora,
          status: statusFinal,
        };

        setUltimoProduto(novoItem);

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

      if (azulTimer.current) {
        clearTimeout(azulTimer.current);
      }

      azulTimer.current = setTimeout(() => {
        setLeituraConfirmada(false);
        setFeedbackVermelho(false);
      }, 450);

      setTimeout(() => {
        ultimoCodigoLido.current = null;
      }, tempoBloqueioMs);
    } catch (error) {
      console.error(
        'Erro ao registrar leitura:',
        error,
      );

      ultimoCodigoLido.current = null;
    } finally {
      setProcessando(false);
    }
  }

  function handleBarcodeScanned({
    data,
    cornerPoints,
  }: {
    data: string;
    cornerPoints?: { x: number; y: number }[];
  }) {
    if (!data) {
      return;
    }

    if (!estaNaZona(cornerPoints)) {
      return;
    }

    if (modoLeitura === 'manual') {
      setEscutandoManual(false);

      if (leituraManualTimer.current) {
        clearTimeout(leituraManualTimer.current);
        leituraManualTimer.current = null;
      }
    }

    void registrarLeitura(data);
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
      setFeedbackAmarelo(true);

      setTimeout(() => {
        setFeedbackAmarelo(false);
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

  async function salvarComoProdutoNovo(
    dados: DadosProdutoRapido,
  ) {
    if (!itemEditando || !conferenciaValida) {
      return;
    }

    try {
      await completarProdutoDesconhecido(
        itemEditando.produto.codigoInterno,
        dados,
      );

      await atualizarStatusLeitura(
        conferenciaId,
        itemEditando.produto.codigoInterno,
        'novo',
      );

      setProdutos((lista) =>
        lista.map((item) =>
          item.produto.codigoInterno ===
          itemEditando.produto.codigoInterno
            ? {
                ...item,
                status: 'novo',
                produto: {
                  ...item.produto,
                  nome: dados.nome,
                  marca: dados.marca,
                  categoria: dados.categoria,
                  origem: 'manual',
                },
              }
            : item,
        ),
      );

      fecharEdicao();
    } catch (error) {
      console.error('Erro ao salvar produto novo:', error);
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
          >
            <View style={styles.scannerFrame}>
              <View style={styles.scannerCornerTopLeft} />
              <View style={styles.scannerCornerTopRight} />
              <View style={styles.scannerCornerBottomLeft} />
              <View style={styles.scannerCornerBottomRight} />
            </View>

            {modoLeitura === 'manual' ? (
              <Pressable
                style={styles.lerButton}
                onPress={handlePressionarLer}
                disabled={escutandoManual}
              >
                <Text style={styles.lerButtonText}>
                  {escutandoManual ? 'LENDO...' : 'TOCAR PARA LER'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.cameraHint}>
                <Text style={styles.cameraHintText}>
                  Aponte para o código de barras
                </Text>
              </View>
            )}
          </CameraView>
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

      {processando && (
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" />
          <Text style={styles.statusText}>
            Consultando produto...
          </Text>
        </View>
      )}

      {ultimoProduto && (
        <View style={styles.lastRead}>
          <Text style={styles.sectionLabel}>ÚLTIMA LEITURA</Text>

          <View
            style={[
              styles.lastReadCard,
              { borderColor: CORES_STATUS[ultimoProduto.status].borda },
            ]}
          >
            <View style={styles.lastReadTop}>
              <Text style={styles.barcode}>
                {ultimoProduto.produto.codigoBarras}
              </Text>

              <View
                style={[
                  styles.badge,
                  { backgroundColor: CORES_STATUS[ultimoProduto.status].fundo },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: CORES_STATUS[ultimoProduto.status].texto },
                  ]}
                >
                  {CORES_STATUS[ultimoProduto.status].etiqueta}
                </Text>
              </View>
            </View>

            <Text style={styles.productName}>
              {ultimoProduto.produto.nome}
            </Text>

            <View style={styles.lastReadFooter}>
              <Text style={styles.internalCode}>
                Cód. interno: {ultimoProduto.produto.codigoInterno}
              </Text>

              <Text style={styles.quantity}>
                Qtd: {ultimoProduto.quantidade}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>PRODUTOS LIDOS</Text>
          <Text style={styles.summaryValue}>{produtos.length}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View>
          <Text style={styles.summaryLabel}>UNIDADES</Text>
          <Text style={styles.summaryValue}>{totalUnidades}</Text>
        </View>
      </View>

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
            produtos.map((item) => {
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

                    <Text style={styles.productBarcode}>
                      {item.produto.codigoBarras || 'sem código de barras'}
                    </Text>
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
            })
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
          <Text style={styles.yellowFeedbackText}>NADA ENCONTRADO</Text>
        </View>
      )}

{itemEditando && (
        <ModalEdicaoItem
          item={itemEditando}
          onFechar={fecharEdicao}
          onSalvarQuantidade={salvarQuantidade}
          onRemover={removerItem}
          onSalvarProdutoNovo={salvarComoProdutoNovo}
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

type ModalEdicaoItemProps = {
  item: LeituraConferencia;
  onFechar: () => void;
  onSalvarQuantidade: (novaQuantidade: number) => void;
  onRemover: () => void;
  onSalvarProdutoNovo: (dados: DadosProdutoRapido) => void;
};

function ModalEdicaoItem({
  item,
  onFechar,
  onSalvarQuantidade,
  onRemover,
  onSalvarProdutoNovo,
}: ModalEdicaoItemProps) {
  const [quantidadeTexto, setQuantidadeTexto] = useState(
    String(item.quantidade),
  );

  const [nome, setNome] = useState(
    item.status === 'desconhecido' ? '' : item.produto.nome,
  );

  const [marca, setMarca] = useState(item.produto.marca ?? '');
  const [categoria, setCategoria] = useState(item.produto.categoria ?? '');

  const ehDesconhecido = item.status === 'desconhecido';

  return (
    <View style={styles.overlay}>
      <View style={styles.editCard}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.editBarcode}>
            {item.produto.codigoBarras || 'sem código de barras'}
          </Text>

          {ehDesconhecido ? (
            <>
              <Text style={styles.editTitle}>
                PRODUTO NÃO IDENTIFICADO
              </Text>

              <Text style={styles.editSubtitle}>
                Preencha o nome para salvar este
                código como um produto novo.
              </Text>

              <Text style={styles.editLabel}>NOME *</Text>
              <TextInput
                style={styles.editInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome do produto"
                placeholderTextColor="#98A2B3"
              />

              <Text style={styles.editLabel}>MARCA</Text>
              <TextInput
                style={styles.editInput}
                value={marca}
                onChangeText={setMarca}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
              />

              <Text style={styles.editLabel}>CATEGORIA</Text>
              <TextInput
                style={styles.editInput}
                value={categoria}
                onChangeText={setCategoria}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
              />

              <Pressable
                style={[
                  styles.editSaveButton,
                  !nome.trim() && styles.editButtonDisabled,
                ]}
                disabled={!nome.trim()}
                onPress={() =>
                  onSalvarProdutoNovo({
                    nome: nome.trim(),
                    marca: marca.trim() || undefined,
                    categoria: categoria.trim() || undefined,
                  })
                }
              >
                <Text style={styles.editSaveButtonText}>
                  SALVAR COMO PRODUTO NOVO
                </Text>
              </Pressable>

              <View style={styles.editDivider} />
            </>
          ) : (
            <Text style={styles.editTitle}>
              {item.produto.nome}
            </Text>
          )}

          <Text style={styles.editLabel}>QUANTIDADE</Text>
          <TextInput
            style={styles.editInput}
            value={quantidadeTexto}
            onChangeText={setQuantidadeTexto}
            keyboardType="number-pad"
          />

          <Pressable
            style={styles.editSaveButton}
            onPress={() =>
              onSalvarQuantidade(Number(quantidadeTexto) || 0)
            }
          >
            <Text style={styles.editSaveButtonText}>
              SALVAR QUANTIDADE
            </Text>
          </Pressable>

          <Pressable style={styles.editRemoveButton} onPress={onRemover}>
            <Text style={styles.editRemoveButtonText}>
              REMOVER DA CONFERÊNCIA
            </Text>
          </Pressable>

          <Pressable style={styles.editCancelButton} onPress={onFechar}>
            <Text style={styles.editCancelButtonText}>CANCELAR</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
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
    height: 190,
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
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

  scannerFrame: {
    position: 'absolute',
    top: 35,
    left: 45,
    right: 45,
    bottom: 35,
  },

  scannerCornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
  },

  scannerCornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
  },

  scannerCornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
  },

  scannerCornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
  },

  cameraHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },

  cameraHintText: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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

  lastRead: {
    marginHorizontal: 18,
    marginTop: 9,
  },

  sectionLabel: {
    marginBottom: 5,
    fontSize: 10,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.8,
  },

  lastReadCard: {
    padding: 11,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },

  lastReadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '900',
  },

  barcode: {
    fontSize: 11,
    color: '#667085',
  },

  productName: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    color: '#18212F',
  },

  lastReadFooter: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  internalCode: {
    fontSize: 11,
    color: '#667085',
  },

  quantity: {
    fontSize: 13,
    fontWeight: '900',
    color: '#208AEF',
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

  editBarcode: {
    fontSize: 11,
    color: '#98A2B3',
    textAlign: 'center',
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
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 13,
    backgroundColor: 'rgba(32, 138, 239, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lerButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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


