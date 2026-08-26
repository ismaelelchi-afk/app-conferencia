// ============================================================
// CADASTRAR / EDITAR PRODUTO — RAMSONS CONFERÊNCIA
// Modo criar: sem params → gera codigoInterno automático.
// Modo editar: recebe ?codigoInterno=XXX → pré-carrega campos.
// ============================================================

import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  atualizarProduto,
  buscarPorCodigoInterno,
  criarProdutoManual,
  removerProduto,
} from '@/database/database';
import type { Produto, TipoProduto } from '@/models/produto';

// ============================================================
// TELA
// ============================================================

export default function CadastrarProdutoScreen() {
  const { codigoInterno: codigoParam } = useLocalSearchParams<{
    codigoInterno?: string;
  }>();

  const modoEdicao = !!codigoParam;

  const [permission, requestPermission] = useCameraPermissions();
  const [mostrarCamera, setMostrarCamera] = useState(false);

  // ----------------------------------------------------------
  // CAMPOS
  // ----------------------------------------------------------

  const [codigoInterno, setCodigoInterno] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [modelo, setModelo] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [tecnologia, setTecnologia] = useState('');
  const [ciclo, setCiclo] = useState('');
  const [voltaje, setVoltaje] = useState('');
  const [color, setColor] = useState('');
  const [peso, setPeso] = useState('');
  const [dimensiones, setDimensiones] = useState('');
  const [link, setLink] = useState('');
  const [tipoProduto, setTipoProduto] = useState<TipoProduto>('normal');
  const [codigoPar, setCodigoPar] = useState('');

  // ----------------------------------------------------------
  // ESTADO DA TELA
  // ----------------------------------------------------------

  const [produtoOriginal, setProdutoOriginal] = useState<Produto | null>(null);
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const nomeValido = nome.trim().length >= 3;

  // ----------------------------------------------------------
  // CARREGAR PRODUTO (modo edição)
  // ----------------------------------------------------------

  useEffect(() => {
    if (!codigoParam) return;

    buscarPorCodigoInterno(codigoParam)
      .then((produto) => {
        if (!produto) {
          setErro('Produto não encontrado.');
          return;
        }

        setProdutoOriginal(produto);
        setCodigoInterno(produto.codigoInterno);
        setCodigoBarras(produto.codigoBarras ?? '');
        setNome(produto.nome);
        setMarca(produto.marca ?? '');
        setCategoria(produto.categoria ?? '');
        setSubcategoria(produto.subcategoria ?? '');
        setModelo(produto.modelo ?? '');
        setCapacidad(produto.capacidad ?? '');
        setTecnologia(produto.tecnologia ?? '');
        setCiclo(produto.ciclo ?? '');
        setVoltaje(produto.voltaje ?? '');
        setColor(produto.color ?? '');
        setPeso(produto.peso ?? '');
        setDimensiones(produto.dimensiones ?? '');
        setLink(produto.link ?? '');
        setTipoProduto(produto.tipoProduto ?? 'normal');
        setCodigoPar(produto.codigoPar ?? '');
      })
      .catch(() => setErro('Erro ao carregar produto.'))
      .finally(() => setCarregando(false));
  }, [codigoParam]);

  // ----------------------------------------------------------
  // CÂMERA — escanear código de barras
  // ----------------------------------------------------------

  async function abrirCamera() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setMostrarCamera(true);
  }

  function handleBarcodeScan({ data }: { data: string }) {
    setCodigoBarras(data);
    setMostrarCamera(false);
  }

  // ----------------------------------------------------------
  // SALVAR
  // ----------------------------------------------------------

  async function salvar() {
    if (!nomeValido || salvando) return;

    setSalvando(true);
    setErro(null);

    try {
      const parTrimmed = codigoPar.trim() || undefined;
      const esAC = tipoProduto === 'evaporadora' || tipoProduto === 'condensadora';

      if (modoEdicao && produtoOriginal) {
        const produtoAtualizado: Produto = {
          ...produtoOriginal,
          codigoInterno: codigoInterno.trim() || produtoOriginal.codigoInterno,
          nome: nome.trim(),
          marca: marca.trim() || undefined,
          categoria: categoria.trim() || undefined,
          subcategoria: subcategoria.trim() || undefined,
          modelo: modelo.trim() || undefined,
          capacidad: capacidad.trim() || undefined,
          tecnologia: tecnologia.trim() || undefined,
          ciclo: ciclo.trim() || undefined,
          voltaje: voltaje.trim() || undefined,
          color: color.trim() || undefined,
          peso: peso.trim() || undefined,
          dimensiones: dimensiones.trim() || undefined,
          tipoProduto,
          codigoPar: esAC ? parTrimmed : undefined,
        };

        await atualizarProduto(produtoAtualizado, codigoParam!);
      } else {
        await criarProdutoManual({
          codigoInterno: codigoInterno.trim() || undefined,
          codigoBarras: codigoBarras.trim() || null,
          nome: nome.trim(),
          marca: marca.trim() || undefined,
          categoria: categoria.trim() || undefined,
          subcategoria: subcategoria.trim() || undefined,
          modelo: modelo.trim() || undefined,
          capacidad: capacidad.trim() || undefined,
          tecnologia: tecnologia.trim() || undefined,
          ciclo: ciclo.trim() || undefined,
          voltaje: voltaje.trim() || undefined,
          color: color.trim() || undefined,
          peso: peso.trim() || undefined,
          dimensiones: dimensiones.trim() || undefined,
          tipoProduto,
          codigoPar: esAC ? parTrimmed : undefined,
        });
      }

      setSucesso(true);
      setTimeout(() => router.back(), 1000);
    } catch {
      setErro(
        modoEdicao
          ? 'Não foi possível salvar as alterações.'
          : 'Não foi possível cadastrar. Verifique se o código já não está em uso.',
      );
    } finally {
      setSalvando(false);
    }
  }

  // ----------------------------------------------------------
  // EXCLUIR
  // ----------------------------------------------------------

  async function excluir() {
    if (!codigoParam || excluindo) return;

    setExcluindo(true);
    setErro(null);

    try {
      await removerProduto(codigoParam);
      router.back();
    } catch {
      setErro('Não foi possível excluir o produto.');
      setExcluindo(false);
      setConfirmarExclusao(false);
    }
  }

  // ----------------------------------------------------------
  // INTERFACE — carregando
  // ----------------------------------------------------------

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // INTERFACE — confirmação de exclusão
  // ----------------------------------------------------------

  if (confirmarExclusao) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => setConfirmarExclusao(false)}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Text style={styles.headerTitle}>EXCLUIR PRODUTO</Text>
            <View style={styles.headerSpace} />
          </View>

          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Confirmar exclusão</Text>
            <Text style={styles.confirmNome}>{nome}</Text>
            {codigoInterno ? (
              <Text style={styles.confirmCodigo}>{codigoInterno}</Text>
            ) : null}
            <Text style={styles.confirmAviso}>
              O produto será desativado e não aparecerá mais nas conferências.
            </Text>

            {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

            <Pressable
              style={styles.deleteConfirmButton}
              onPress={() => { void excluir(); }}
              disabled={excluindo}
            >
              {excluindo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteConfirmButtonText}>
                  SIM, EXCLUIR PRODUTO
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setConfirmarExclusao(false)}
              disabled={excluindo}
            >
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // INTERFACE — formulário principal
  // ----------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {modoEdicao ? 'EDITAR PRODUTO' : 'CADASTRAR PRODUTO'}
          </Text>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {sucesso && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {modoEdicao
                  ? '✓ Alterações salvas!'
                  : '✓ Produto cadastrado com sucesso!'}
              </Text>
            </View>
          )}

          {/* CÓDIGO DE BARRAS */}
          <Text style={styles.label}>
            CÓDIGO DE BARRAS{modoEdicao ? ' (não pode ser alterado)' : ''}
          </Text>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, styles.barcodeInput, modoEdicao && styles.inputReadonly]}
              value={codigoBarras}
              onChangeText={modoEdicao ? undefined : setCodigoBarras}
              placeholder="Opcional"
              placeholderTextColor="#98A2B3"
              keyboardType="number-pad"
              editable={!modoEdicao && !salvando && !sucesso}
            />
            {!modoEdicao && (
              <Pressable
                style={[styles.cameraButton, (salvando || sucesso) && styles.cameraButtonDisabled]}
                onPress={() => { void abrirCamera(); }}
                disabled={salvando || sucesso}
              >
                <Text style={styles.cameraIcon}>📷</Text>
              </Pressable>
            )}
          </View>

          {/* CÓDIGO INTERNO */}
          <Text style={styles.label}>
            CÓDIGO INTERNO{modoEdicao ? '' : ' (opcional — gerado automaticamente)'}
          </Text>
          <TextInput
            style={styles.input}
            value={codigoInterno}
            onChangeText={setCodigoInterno}
            placeholder={modoEdicao ? '' : 'Ex.: MAN-001 (deixe em branco para gerar)'}
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
            autoCapitalize="characters"
          />

          {/* NOME */}
          <Text style={styles.label}>NOME *</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do produto (mínimo 3 caracteres)"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* MARCA */}
          <Text style={styles.label}>MARCA</Text>
          <TextInput
            style={styles.input}
            value={marca}
            onChangeText={setMarca}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* CATEGORIA */}
          <Text style={styles.label}>CATEGORIA</Text>
          <TextInput
            style={styles.input}
            value={categoria}
            onChangeText={setCategoria}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* MODELO */}
          <Text style={styles.label}>MODELO</Text>
          <TextInput
            style={styles.input}
            value={modelo}
            onChangeText={setModelo}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* SUBCATEGORÍA */}
          <Text style={styles.label}>SUBCATEGORÍA</Text>
          <TextInput
            style={styles.input}
            value={subcategoria}
            onChangeText={setSubcategoria}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* CAPACIDAD */}
          <Text style={styles.label}>CAPACIDAD</Text>
          <TextInput
            style={styles.input}
            value={capacidad}
            onChangeText={setCapacidad}
            placeholder="Ej.: 9000 BTU"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* TECNOLOGÍA */}
          <Text style={styles.label}>TECNOLOGÍA</Text>
          <TextInput
            style={styles.input}
            value={tecnologia}
            onChangeText={setTecnologia}
            placeholder="Ej.: Inverter"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* CICLO */}
          <Text style={styles.label}>CICLO</Text>
          <TextInput
            style={styles.input}
            value={ciclo}
            onChangeText={setCiclo}
            placeholder="Ej.: Frío/Calor"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* VOLTAJE */}
          <Text style={styles.label}>VOLTAJE</Text>
          <TextInput
            style={styles.input}
            value={voltaje}
            onChangeText={setVoltaje}
            placeholder="Ej.: 220V"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* COLOR */}
          <Text style={styles.label}>COLOR</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="Opcional"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* PESO */}
          <Text style={styles.label}>PESO</Text>
          <TextInput
            style={styles.input}
            value={peso}
            onChangeText={setPeso}
            placeholder="Ej.: 12 kg"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* DIMENSIONES */}
          <Text style={styles.label}>DIMENSIONES</Text>
          <TextInput
            style={styles.input}
            value={dimensiones}
            onChangeText={setDimensiones}
            placeholder="Ej.: 80x30x20 cm"
            placeholderTextColor="#98A2B3"
            editable={!salvando && !sucesso}
          />

          {/* LINK — só exibe, não editável */}
          {link ? (
            <>
              <Text style={styles.label}>LINK</Text>
              <Pressable onPress={() => { void Linking.openURL(link); }}>
                <Text style={styles.linkText} numberOfLines={2}>{link}</Text>
              </Pressable>
            </>
          ) : null}

          {/* TIPO DE PRODUTO */}
          <Text style={styles.label}>TIPO DE PRODUTO</Text>
          <View style={[styles.tipoSelector, (salvando || sucesso) && styles.tipoSelectorDesabilitado]}>
            {([
              { valor: 'normal', label: 'Normal' },
              { valor: 'evaporadora', label: 'Evaporadora' },
              { valor: 'condensadora', label: 'Condensadora' },
            ] as { valor: TipoProduto; label: string }[]).map((opcao) => (
              <Pressable
                key={opcao.valor}
                style={[
                  styles.tipoOpcao,
                  tipoProduto === opcao.valor && styles.tipoOpcaoAtiva,
                ]}
                onPress={() => setTipoProduto(opcao.valor)}
                disabled={salvando || sucesso}
              >
                <Text
                  style={[
                    styles.tipoOpcaoTexto,
                    tipoProduto === opcao.valor && styles.tipoOpcaoTextoAtivo,
                  ]}
                >
                  {opcao.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {(tipoProduto === 'evaporadora' || tipoProduto === 'condensadora') && (
            <>
              <Text style={styles.label}>CÓDIGO DO CONJUNTO</Text>
              <Text style={styles.labelHelper}>Use o mesmo código na evaporadora e condensadora correspondentes</Text>
              <TextInput
                style={styles.input}
                value={codigoPar}
                onChangeText={setCodigoPar}
                placeholder="Ex.: SPRINGER-9000 (opcional)"
                placeholderTextColor="#98A2B3"
                autoCapitalize="characters"
                editable={!salvando && !sucesso}
              />
            </>
          )}

          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

          {/* BOTÃO SALVAR */}
          <Pressable
            style={[
              styles.saveButton,
              (!nomeValido || salvando || sucesso) && styles.saveButtonDisabled,
            ]}
            onPress={() => { void salvar(); }}
            disabled={!nomeValido || salvando || sucesso}
          >
            {salvando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {modoEdicao ? 'GUARDAR CAMBIOS' : 'SALVAR PRODUTO'}
              </Text>
            )}
          </Pressable>

          {/* BOTÃO EXCLUIR (só no modo edição) */}
          {modoEdicao && !sucesso && (
            <Pressable
              style={styles.deleteButton}
              onPress={() => setConfirmarExclusao(true)}
              disabled={salvando}
            >
              <Text style={styles.deleteButtonText}>EXCLUIR PRODUTO</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* CÂMERA MODAL */}
      <Modal
        visible={mostrarCamera}
        animationType="slide"
        onRequestClose={() => setMostrarCamera(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleBarcodeScan}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraMira} />
          </View>
          <Pressable
            style={styles.cameraCloseButton}
            onPress={() => setMostrarCamera(false)}
          >
            <Text style={styles.cameraCloseText}>✕  CANCELAR</Text>
          </Pressable>
        </View>
      </Modal>
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 36,
  },

  successBox: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#ECFDF3',
    marginBottom: 16,
  },

  successText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#12B76A',
    textAlign: 'center',
  },

  label: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.6,
  },

  labelHelper: {
    marginTop: 3,
    fontSize: 10,
    color: '#98A2B3',
    lineHeight: 14,
  },

  input: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#18212F',
  },

  inputReadonly: {
    backgroundColor: '#F5F7FA',
    color: '#667085',
  },

  barcodeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  barcodeInput: {
    flex: 1,
    marginTop: 0,
  },

  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraButtonDisabled: {
    opacity: 0.4,
  },

  cameraIcon: {
    fontSize: 22,
  },

  linkText: {
    marginTop: 6,
    fontSize: 13,
    color: '#208AEF',
    textDecorationLine: 'underline',
  },

  errorText: {
    marginTop: 16,
    fontSize: 13,
    color: '#D92D20',
    textAlign: 'center',
  },

  saveButton: {
    height: 56,
    marginTop: 26,
    borderRadius: 15,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  deleteButton: {
    height: 52,
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D92D20',
  },

  // Confirmação de exclusão
  confirmBox: {
    flex: 1,
    paddingTop: 24,
  },

  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18212F',
    marginBottom: 16,
  },

  confirmNome: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18212F',
  },

  confirmCodigo: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
    marginBottom: 16,
  },

  confirmAviso: {
    fontSize: 14,
    color: '#667085',
    lineHeight: 20,
    marginBottom: 24,
  },

  deleteConfirmButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  deleteConfirmButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  cancelButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E1E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667085',
  },

  tipoSelector: {
    marginTop: 8,
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    overflow: 'hidden',
  },

  tipoSelectorDesabilitado: {
    opacity: 0.6,
  },

  tipoOpcao: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  tipoOpcaoAtiva: {
    backgroundColor: '#208AEF',
  },

  tipoOpcaoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
  },

  tipoOpcaoTextoAtivo: {
    color: '#FFFFFF',
  },

  // Câmera
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraMira: {
    width: 240,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#208AEF',
  },

  cameraCloseButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  cameraCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
