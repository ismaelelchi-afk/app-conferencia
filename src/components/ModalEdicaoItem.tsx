import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatarCodigoInterno } from '@/database/database';
import type {
  DadosProdutoRapido,
  LeituraConferencia,
  TipoProduto,
} from '@/models/produto';

type DadosProduto = {
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
};

type Props = {
  item: LeituraConferencia;
  onFechar: () => void;
  onSalvarQuantidade?: (novaQuantidade: number) => void;
  onRemover: () => void;
  onSalvarProdutoNovo: (dados: DadosProdutoRapido) => Promise<void>;
  onAtualizarTipo?: (tipo: TipoProduto) => Promise<string | null>;
  onSalvarDadosProduto?: (dados: DadosProduto) => Promise<string | null>;
  itensConferencia?: LeituraConferencia[];
  onParear?: (codigoInternoSocio: string, codigoPar: string, tipoSocio: TipoProduto, tipoItem: TipoProduto) => Promise<string | null>;
  onDesparear?: () => Promise<string | null>;
};

const OPCOES_TIPO: { valor: TipoProduto; label: string }[] = [
  { valor: 'normal', label: 'Normal' },
  { valor: 'evaporadora', label: 'Evaporadora' },
  { valor: 'condensadora', label: 'Condensadora' },
];

export function ModalEdicaoItem({
  item,
  onFechar,
  onSalvarQuantidade,
  onRemover,
  onSalvarProdutoNovo,
  onAtualizarTipo,
  onSalvarDadosProduto,
  itensConferencia,
  onParear,
  onDesparear,
}: Props) {
  // Campos para produto desconhecido
  const [codigoInterno, setCodigoInterno] = useState(
    item.produto.codigoInterno,
  );
  const [nome, setNome] = useState(
    item.status === 'desconhecido' ? '' : item.produto.nome,
  );
  const [marca, setMarca] = useState(item.produto.marca ?? '');
  const [categoria, setCategoria] = useState(item.produto.categoria ?? '');
  const [subcategoria, setSubcategoria] = useState(item.produto.subcategoria ?? '');
  const [modelo, setModelo] = useState(item.produto.modelo ?? '');
  const [capacidad, setCapacidad] = useState(item.produto.capacidad ?? '');
  const [tecnologia, setTecnologia] = useState(item.produto.tecnologia ?? '');
  const [ciclo, setCiclo] = useState(item.produto.ciclo ?? '');
  const [voltaje, setVoltaje] = useState(item.produto.voltaje ?? '');
  const [color, setColor] = useState(item.produto.color ?? '');
  const [peso, setPeso] = useState(item.produto.peso ?? '');
  const [dimensiones, setDimensiones] = useState(item.produto.dimensiones ?? '');
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  // Tipo de produto
  const [tipoLocal, setTipoLocal] = useState<TipoProduto>(
    item.produto.tipoProduto ?? 'normal',
  );
  const [codigoPar, setCodigoPar] = useState(item.produto.codigoPar ?? '');

  // Pareamento
  const [parceiroCodigo, setParceiroCodigo] = useState<string | null>(
    item.produto.codigoPar ?? null,
  );
  const [pareando, setPareando] = useState(false);
  const [despareando, setDespareando] = useState(false);
  const [erroPareamento, setErroPareamento] = useState<string | null>(null);
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  const [erroTipo, setErroTipo] = useState<string | null>(null);

  const ehDesconhecido = item.status === 'desconhecido';
  const nomeValido = nome.trim().length >= 3;

  const tipoOposto = tipoLocal === 'evaporadora' ? 'condensadora' : 'evaporadora';
  const parceirosDisponiveis = (itensConferencia ?? []).filter(
    (it) =>
      it.produto.codigoInterno !== item.produto.codigoInterno &&
      (it.produto.tipoProduto === tipoOposto || it.produto.tipoProduto === 'normal') &&
      !it.produto.codigoPar,
  );
  const parceiroAtual = parceiroCodigo
    ? (itensConferencia ?? []).find(
        (it) =>
          it.produto.codigoPar === parceiroCodigo &&
          it.produto.codigoInterno !== item.produto.codigoInterno,
      )
    : undefined;

  async function handleParear(codigoInternoSocio: string) {
    if (!onParear || pareando) return;
    const novoCodigo =
      tipoLocal === 'evaporadora'
        ? `PAR-${item.produto.codigoInterno}`
        : `PAR-${codigoInternoSocio}`;
    setPareando(true);
    setErroPareamento(null);
    const erro = await onParear(codigoInternoSocio, novoCodigo, tipoOposto, tipoLocal);
    if (erro) {
      setErroPareamento(erro);
    } else {
      setParceiroCodigo(novoCodigo);
    }
    setPareando(false);
  }

  async function handleDesparear() {
    if (!onDesparear || despareando) return;
    setDespareando(true);
    setErroPareamento(null);
    const erro = await onDesparear();
    if (erro) {
      setErroPareamento(erro);
    } else {
      setParceiroCodigo(null);
    }
    setDespareando(false);
  }

  async function handleSelecionarTipo(tipo: TipoProduto) {
    if (!onAtualizarTipo || salvandoTipo || tipo === tipoLocal) return;

    setSalvandoTipo(true);
    setErroTipo(null);

    const erro = await onAtualizarTipo(tipo);
    if (erro) {
      setErroTipo(erro);
    } else {
      setTipoLocal(tipo);
    }
    setSalvandoTipo(false);
  }

  async function handleSalvarNovo() {
    if (salvandoNovo || !nomeValido) return;
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      await onSalvarProdutoNovo({
        codigoInterno: codigoInterno.trim() || undefined,
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
        tipoProduto: tipoLocal,
        codigoPar: codigoPar.trim() || undefined,
      });
    } catch {
      setErroNovo('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function handleSalvarDados() {
    if (!onSalvarDadosProduto || salvandoDados || !nomeValido) return;

    setSalvandoDados(true);
    setErroDados(null);

    const erro = await onSalvarDadosProduto({
      codigoInterno: codigoInterno.trim() || undefined,
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
    });

    if (erro) {
      setErroDados(erro);
    }
    setSalvandoDados(false);
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.editCard}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Código de barras */}
          <View style={styles.barcodeBox}>
            <Text style={styles.barcodeBoxLabel}>CÓDIGO DE BARRAS</Text>
            <Text selectable style={styles.barcodeBoxValue}>
              {item.produto.codigoBarras || 'sem código de barras'}
            </Text>
          </View>

          {ehDesconhecido ? (
            <>
              <Text style={styles.editTitle}>PRODUTO NÃO IDENTIFICADO</Text>

              <Text style={styles.editSubtitle}>
                Preencha os dados para salvar este código como um produto novo.
              </Text>

              <Text style={styles.editLabel}>CÓDIGO INTERNO</Text>
              <TextInput
                style={styles.editInput}
                value={codigoInterno}
                onChangeText={setCodigoInterno}
                placeholder="Código interno"
                placeholderTextColor="#98A2B3"
                autoCapitalize="characters"
              />

              <Text style={styles.editLabel}>NOME *</Text>
              <TextInput
                style={styles.editInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome do produto (mín. 3 caracteres)"
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

              <Text style={styles.editLabel}>SUBCATEGORÍA</Text>
              <TextInput style={styles.editInput} value={subcategoria} onChangeText={setSubcategoria} placeholder="Opcional" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>MODELO</Text>
              <TextInput style={styles.editInput} value={modelo} onChangeText={setModelo} placeholder="Opcional" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>CAPACIDAD</Text>
              <TextInput style={styles.editInput} value={capacidad} onChangeText={setCapacidad} placeholder="Ej.: 9000 BTU" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>TECNOLOGÍA</Text>
              <TextInput style={styles.editInput} value={tecnologia} onChangeText={setTecnologia} placeholder="Ej.: Inverter" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>CICLO</Text>
              <TextInput style={styles.editInput} value={ciclo} onChangeText={setCiclo} placeholder="Ej.: Frío/Calor" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>VOLTAJE</Text>
              <TextInput style={styles.editInput} value={voltaje} onChangeText={setVoltaje} placeholder="Ej.: 220V" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>COLOR</Text>
              <TextInput style={styles.editInput} value={color} onChangeText={setColor} placeholder="Opcional" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>PESO</Text>
              <TextInput style={styles.editInput} value={peso} onChangeText={setPeso} placeholder="Ej.: 12 kg" placeholderTextColor="#98A2B3" />

              <Text style={styles.editLabel}>DIMENSIONES</Text>
              <TextInput style={styles.editInput} value={dimensiones} onChangeText={setDimensiones} placeholder="Ej.: 80x30x20 cm" placeholderTextColor="#98A2B3" />

              {item.produto.link ? (
                <>
                  <Text style={styles.editLabel}>LINK</Text>
                  <Pressable onPress={() => { void Linking.openURL(item.produto.link!); }}>
                    <Text style={styles.linkText} numberOfLines={2}>{item.produto.link}</Text>
                  </Pressable>
                </>
              ) : null}

              <Text style={styles.editLabel}>TIPO DE PRODUTO</Text>
              <View style={styles.tipoSelector}>
                {OPCOES_TIPO.map((opcao) => (
                  <Pressable
                    key={opcao.valor}
                    style={[
                      styles.tipoOpcao,
                      tipoLocal === opcao.valor && styles.tipoOpcaoAtiva,
                    ]}
                    onPress={() => setTipoLocal(opcao.valor)}
                  >
                    <Text
                      style={[
                        styles.tipoOpcaoTexto,
                        tipoLocal === opcao.valor && styles.tipoOpcaoTextoAtivo,
                      ]}
                    >
                      {opcao.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {(tipoLocal === 'evaporadora' || tipoLocal === 'condensadora') && (
                <>
                  <Text style={styles.editLabel}>CÓDIGO DO CONJUNTO</Text>
                  <TextInput
                    style={styles.editInput}
                    value={codigoPar}
                    onChangeText={setCodigoPar}
                    placeholder="Ex: AC-SALA-01"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="characters"
                  />
                </>
              )}

              {erroNovo ? (
                <Text style={styles.erroText}>{erroNovo}</Text>
              ) : null}

              <Pressable
                style={[
                  styles.editSaveButton,
                  (!nomeValido || salvandoNovo) && styles.editButtonDisabled,
                ]}
                disabled={!nomeValido || salvandoNovo}
                onPress={() => { void handleSalvarNovo(); }}
              >
                <Text style={styles.editSaveButtonText}>
                  {salvandoNovo ? 'SALVANDO...' : 'SALVAR COMO PRODUTO NOVO'}
                </Text>
              </Pressable>

              <View style={styles.editDivider} />
            </>
          ) : (
            <>
              <Text style={styles.editTitle}>{item.produto.nome}</Text>

              {/* Dados editáveis do produto */}
              {onSalvarDadosProduto && (
                <>
                  <Text style={styles.editLabel}>CÓDIGO INTERNO</Text>
                  <TextInput
                    style={styles.editInput}
                    value={codigoInterno}
                    onChangeText={(v) => { setCodigoInterno(v); setErroDados(null); }}
                    placeholder="Código interno"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="characters"
                    editable={!salvandoDados}
                  />

                  <Text style={styles.editLabel}>NOME</Text>
                  <TextInput
                    style={styles.editInput}
                    value={nome}
                    onChangeText={(v) => { setNome(v); setErroDados(null); }}
                    placeholder="Nome do produto"
                    placeholderTextColor="#98A2B3"
                    editable={!salvandoDados}
                  />

                  <Text style={styles.editLabel}>MARCA</Text>
                  <TextInput
                    style={styles.editInput}
                    value={marca}
                    onChangeText={setMarca}
                    placeholder="Opcional"
                    placeholderTextColor="#98A2B3"
                    editable={!salvandoDados}
                  />

                  <Text style={styles.editLabel}>CATEGORIA</Text>
                  <TextInput style={styles.editInput} value={categoria} onChangeText={setCategoria} placeholder="Opcional" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>SUBCATEGORÍA</Text>
                  <TextInput style={styles.editInput} value={subcategoria} onChangeText={setSubcategoria} placeholder="Opcional" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>MODELO</Text>
                  <TextInput style={styles.editInput} value={modelo} onChangeText={setModelo} placeholder="Opcional" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>CAPACIDAD</Text>
                  <TextInput style={styles.editInput} value={capacidad} onChangeText={setCapacidad} placeholder="Ej.: 9000 BTU" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>TECNOLOGÍA</Text>
                  <TextInput style={styles.editInput} value={tecnologia} onChangeText={setTecnologia} placeholder="Ej.: Inverter" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>CICLO</Text>
                  <TextInput style={styles.editInput} value={ciclo} onChangeText={setCiclo} placeholder="Ej.: Frío/Calor" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>VOLTAJE</Text>
                  <TextInput style={styles.editInput} value={voltaje} onChangeText={setVoltaje} placeholder="Ej.: 220V" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>COLOR</Text>
                  <TextInput style={styles.editInput} value={color} onChangeText={setColor} placeholder="Opcional" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>PESO</Text>
                  <TextInput style={styles.editInput} value={peso} onChangeText={setPeso} placeholder="Ej.: 12 kg" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  <Text style={styles.editLabel}>DIMENSIONES</Text>
                  <TextInput style={styles.editInput} value={dimensiones} onChangeText={setDimensiones} placeholder="Ej.: 80x30x20 cm" placeholderTextColor="#98A2B3" editable={!salvandoDados} />

                  {item.produto.link ? (
                    <>
                      <Text style={styles.editLabel}>LINK</Text>
                      <Pressable onPress={() => { void Linking.openURL(item.produto.link!); }}>
                        <Text style={styles.linkText} numberOfLines={2}>{item.produto.link}</Text>
                      </Pressable>
                    </>
                  ) : null}

                  {erroDados ? (
                    <Text style={styles.erroText}>{erroDados}</Text>
                  ) : null}

                  <Pressable
                    style={[
                      styles.editSaveButton,
                      styles.editSaveButtonSecundario,
                      (!nomeValido || salvandoDados) && styles.editButtonDisabled,
                    ]}
                    disabled={!nomeValido || salvandoDados}
                    onPress={() => { void handleSalvarDados(); }}
                  >
                    <Text style={styles.editSaveButtonText}>
                      SALVAR DADOS DO PRODUTO
                    </Text>
                  </Pressable>
                </>
              )}

              {/* Tipo de produto */}
              {onAtualizarTipo && (
                <>
                  <Text style={styles.editLabel}>TIPO DE PRODUTO</Text>
                  <View
                    style={[
                      styles.tipoSelector,
                      salvandoTipo && styles.tipoSelectorDesabilitado,
                    ]}
                  >
                    {OPCOES_TIPO.map((opcao) => (
                      <Pressable
                        key={opcao.valor}
                        style={[
                          styles.tipoOpcao,
                          tipoLocal === opcao.valor && styles.tipoOpcaoAtiva,
                        ]}
                        onPress={() => { void handleSelecionarTipo(opcao.valor); }}
                        disabled={salvandoTipo}
                      >
                        <Text
                          style={[
                            styles.tipoOpcaoTexto,
                            tipoLocal === opcao.valor && styles.tipoOpcaoTextoAtivo,
                          ]}
                        >
                          {opcao.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {erroTipo ? (
                    <Text style={styles.erroText}>{erroTipo}</Text>
                  ) : null}
                </>
              )}

              {/* Pareamento */}
              {(tipoLocal === 'evaporadora' || tipoLocal === 'condensadora') && onParear && (
                <>
                  <Text style={styles.editLabel}>
                    {tipoLocal === 'evaporadora' ? 'CONDENSADORA PARCEIRA' : 'EVAPORADORA PARCEIRA'}
                  </Text>

                  {parceiroCodigo ? (
                    <View style={styles.parceiroBox}>
                      <View style={styles.parceiroInfo}>
                        <Text style={styles.parceiroNome} numberOfLines={1}>
                          {parceiroAtual ? parceiroAtual.produto.nome : '—'}
                        </Text>
                        <Text style={styles.parceiroCodigo}>{parceiroCodigo}</Text>
                      </View>
                      <Pressable
                        style={[styles.desparerarBtn, despareando && styles.editButtonDisabled]}
                        onPress={() => { void handleDesparear(); }}
                        disabled={despareando}
                      >
                        <Text style={styles.desparerarBtnText}>DESPAREAR</Text>
                      </Pressable>
                    </View>
                  ) : parceirosDisponiveis.length > 0 ? (
                    <View style={styles.parceirosLista}>
                      {parceirosDisponiveis.map((p) => (
                        <Pressable
                          key={p.produto.codigoInterno}
                          style={[styles.parceiroOpcao, pareando && styles.editButtonDisabled]}
                          onPress={() => { void handleParear(p.produto.codigoInterno); }}
                          disabled={pareando}
                        >
                          <View style={styles.parceiroOpcaoRow}>
                            <Text style={styles.parceiroOpcaoNome} numberOfLines={1}>
                              {p.produto.nome}
                            </Text>
                            {p.produto.tipoProduto === 'normal' && (
                              <View style={styles.parceiroTipoBadge}>
                                <Text style={styles.parceiroTipoBadgeText}>
                                  → {tipoOposto === 'evaporadora' ? 'Evaporadora' : 'Condensadora'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.parceiroOpcaoCodigo}>
                            {formatarCodigoInterno(p.produto.codigoInterno)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.parceiroVazio}>
                      Nenhum produto disponível para parear na conferência
                    </Text>
                  )}

                  {erroPareamento ? (
                    <Text style={styles.erroText}>{erroPareamento}</Text>
                  ) : null}
                </>
              )}

              <View style={styles.editDivider} />
            </>
          )}

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
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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

  // Tipo de produto selector
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
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },

  tipoOpcaoAtiva: {
    backgroundColor: '#208AEF',
  },

  tipoOpcaoTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
  },

  tipoOpcaoTextoAtivo: {
    color: '#FFFFFF',
  },

  erroText: {
    marginTop: 8,
    fontSize: 12,
    color: '#D92D20',
    textAlign: 'center',
  },

  linkText: {
    marginTop: 6,
    fontSize: 13,
    color: '#208AEF',
    textDecorationLine: 'underline',
  },

  editSaveButtonCond: {
    backgroundColor: '#175CD3',
  },

  editSaveButtonSecundario: {
    backgroundColor: '#344054',
  },

  // Formulário
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

  parceiroBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },

  parceiroInfo: {
    flex: 1,
  },

  parceiroNome: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18212F',
  },

  parceiroCodigo: {
    fontSize: 10,
    color: '#667085',
    marginTop: 2,
  },

  desparerarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F04438',
  },

  desparerarBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F04438',
  },

  parceirosLista: {
    marginTop: 8,
    gap: 6,
  },

  parceiroOpcao: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },

  parceiroOpcaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },

  parceiroOpcaoNome: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18212F',
    flexShrink: 1,
  },

  parceiroOpcaoCodigo: {
    fontSize: 10,
    color: '#667085',
    marginTop: 2,
  },

  parceiroTipoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EFF8FF',
  },

  parceiroTipoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#175CD3',
  },

  parceiroVazio: {
    marginTop: 8,
    fontSize: 12,
    color: '#98A2B3',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
