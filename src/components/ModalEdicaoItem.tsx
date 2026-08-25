import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {
  DadosProdutoRapido,
  LeituraConferencia,
  TipoProduto,
} from '@/models/produto';

type DadosProduto = {
  nome: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  descricao?: string;
};

type Props = {
  item: LeituraConferencia;
  onFechar: () => void;
  onSalvarQuantidade: (novaQuantidade: number) => void;
  onRemover: () => void;
  onSalvarProdutoNovo: (dados: DadosProdutoRapido) => void;
  onSalvarCond?: (codigoBarrasCond: string) => Promise<string | null>;
  onAtualizarTipo?: (tipo: TipoProduto) => Promise<string | null>;
  onSalvarDadosProduto?: (dados: DadosProduto) => Promise<string | null>;
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
  onSalvarCond,
  onAtualizarTipo,
  onSalvarDadosProduto,
}: Props) {
  const [quantidadeTexto, setQuantidadeTexto] = useState(
    String(item.quantidade),
  );

  // Campos para produto desconhecido
  const [codigoInterno, setCodigoInterno] = useState(
    item.produto.codigoInterno,
  );
  const [nome, setNome] = useState(
    item.status === 'desconhecido' ? '' : item.produto.nome,
  );
  const [marca, setMarca] = useState(item.produto.marca ?? '');
  const [categoria, setCategoria] = useState(item.produto.categoria ?? '');
  const [modelo, setModelo] = useState(item.produto.modelo ?? '');
  const [descricao, setDescricao] = useState(item.produto.descricao ?? '');
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [erroDados, setErroDados] = useState<string | null>(null);

  // Tipo de produto
  const [tipoLocal, setTipoLocal] = useState<TipoProduto>(
    item.produto.tipoProduto,
  );
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  const [erroTipo, setErroTipo] = useState<string | null>(null);

  // COND barcode
  const [novaCondBarras, setNovaCondBarras] = useState(
    item.produto.codigoBarrasCond ?? '',
  );
  const [salvandoCond, setSalvandoCond] = useState(false);
  const [erroCond, setErroCond] = useState<string | null>(null);

  const ehDesconhecido = item.status === 'desconhecido';
  const nomeValido = nome.trim().length >= 3;

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

  async function handleSalvarDados() {
    if (!onSalvarDadosProduto || salvandoDados || !nomeValido) return;

    setSalvandoDados(true);
    setErroDados(null);

    const erro = await onSalvarDadosProduto({
      nome: nome.trim(),
      marca: marca.trim() || undefined,
      categoria: categoria.trim() || undefined,
      modelo: modelo.trim() || undefined,
      descricao: descricao.trim() || undefined,
    });

    if (erro) {
      setErroDados(erro);
    }
    setSalvandoDados(false);
  }

  async function handleSalvarCond() {
    if (!onSalvarCond || salvandoCond) return;
    const trimmed = novaCondBarras.trim();
    if (!trimmed) return;

    setSalvandoCond(true);
    setErroCond(null);
    const erro = await onSalvarCond(trimmed);
    if (erro) {
      setErroCond(erro);
      setSalvandoCond(false);
    }
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

              <Text style={styles.editLabel}>MODELO</Text>
              <TextInput
                style={styles.editInput}
                value={modelo}
                onChangeText={setModelo}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
              />

              <Text style={styles.editLabel}>CÓDIGO INTERNO</Text>
              <TextInput
                style={styles.editInput}
                value={codigoInterno}
                onChangeText={setCodigoInterno}
                placeholder="Gerado automaticamente"
                placeholderTextColor="#98A2B3"
                autoCapitalize="characters"
              />

              <Text style={styles.editLabel}>DESCRIÇÃO</Text>
              <TextInput
                style={styles.editInput}
                value={descricao}
                onChangeText={setDescricao}
                placeholder="Opcional"
                placeholderTextColor="#98A2B3"
              />

              <Pressable
                style={[
                  styles.editSaveButton,
                  !nomeValido && styles.editButtonDisabled,
                ]}
                disabled={!nomeValido}
                onPress={() =>
                  onSalvarProdutoNovo({
                    codigoInterno: codigoInterno.trim() || undefined,
                    nome: nome.trim(),
                    marca: marca.trim() || undefined,
                    categoria: categoria.trim() || undefined,
                    modelo: modelo.trim() || undefined,
                    descricao: descricao.trim() || undefined,
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
            <>
              <Text style={styles.editTitle}>{item.produto.nome}</Text>

              {/* Dados editáveis do produto */}
              {onSalvarDadosProduto && (
                <>
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
                  <TextInput
                    style={styles.editInput}
                    value={categoria}
                    onChangeText={setCategoria}
                    placeholder="Opcional"
                    placeholderTextColor="#98A2B3"
                    editable={!salvandoDados}
                  />

                  <Text style={styles.editLabel}>MODELO</Text>
                  <TextInput
                    style={styles.editInput}
                    value={modelo}
                    onChangeText={setModelo}
                    placeholder="Opcional"
                    placeholderTextColor="#98A2B3"
                    editable={!salvandoDados}
                  />

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

              {/* Código barras COND (só quando Evaporadora) */}
              {tipoLocal === 'evaporadora' && onSalvarCond && (
                <>
                  <Text style={styles.editLabel}>CÓDIGO BARRAS COND</Text>
                  <TextInput
                    style={styles.editInput}
                    value={novaCondBarras}
                    onChangeText={(v) => {
                      setNovaCondBarras(v);
                      setErroCond(null);
                    }}
                    placeholder={
                      item.produto.codigoBarrasCond || 'Não cadastrada'
                    }
                    placeholderTextColor="#98A2B3"
                    keyboardType="number-pad"
                    editable={!salvandoCond}
                  />

                  {erroCond ? (
                    <Text style={styles.erroText}>{erroCond}</Text>
                  ) : null}

                  <Pressable
                    style={[
                      styles.editSaveButton,
                      styles.editSaveButtonCond,
                      (!novaCondBarras.trim() || salvandoCond) &&
                        styles.editButtonDisabled,
                    ]}
                    disabled={!novaCondBarras.trim() || salvandoCond}
                    onPress={() => { void handleSalvarCond(); }}
                  >
                    <Text style={styles.editSaveButtonText}>
                      SALVAR COND
                    </Text>
                  </Pressable>
                </>
              )}

              <View style={styles.editDivider} />
            </>
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
            onPress={() => onSalvarQuantidade(Number(quantidadeTexto) || 0)}
          >
            <Text style={styles.editSaveButtonText}>SALVAR QUANTIDADE</Text>
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
});
