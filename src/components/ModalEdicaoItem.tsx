import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { DadosProdutoRapido, LeituraConferencia } from '@/models/produto';

type Props = {
  item: LeituraConferencia;
  onFechar: () => void;
  onSalvarQuantidade: (novaQuantidade: number) => void;
  onRemover: () => void;
  onSalvarProdutoNovo: (dados: DadosProdutoRapido) => void;
  onSalvarCond?: (codigoBarrasCond: string) => Promise<string | null>;
};

export function ModalEdicaoItem({
  item,
  onFechar,
  onSalvarQuantidade,
  onRemover,
  onSalvarProdutoNovo,
  onSalvarCond,
}: Props) {
  const [quantidadeTexto, setQuantidadeTexto] = useState(
    String(item.quantidade),
  );

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

  const [novaCondBarras, setNovaCondBarras] = useState(
    item.produto.codigoBarrasCond ?? '',
  );
  const [salvandoCond, setSalvandoCond] = useState(false);
  const [erroCond, setErroCond] = useState<string | null>(null);

  const ehDesconhecido = item.status === 'desconhecido';
  const ehAr = item.produto.esArAcondicionado;
  const nomeValido = nome.trim().length >= 3;

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

          {/* Código de barras VAP */}
          <View style={styles.barcodeBox}>
            <Text style={styles.barcodeBoxLabel}>
              {ehAr ? 'CÓDIGO DE BARRAS VAP' : 'CÓDIGO DE BARRAS'}
            </Text>
            <Text style={styles.barcodeBoxValue}>
              {item.produto.codigoBarras || 'sem código de barras'}
            </Text>
          </View>

          {/* Seção de ar condicionado */}
          {ehAr && !ehDesconhecido && (
            <View style={styles.acSection}>
              <Text style={styles.acSectionTitle}>❄ CONJUNTO VAP + COND</Text>

              <View style={styles.acRow}>
                <View style={styles.acParteInfo}>
                  <Text style={styles.acParteTitulo}>VAP / Evaporadora</Text>
                  <Text style={styles.acParteBarcode}>
                    {item.produto.codigoBarras || 'sem código'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.acStatus,
                    item.vapLida ? styles.acStatusOk : styles.acStatusPend,
                  ]}
                >
                  <Text
                    style={[
                      styles.acStatusText,
                      item.vapLida
                        ? styles.acStatusTextOk
                        : styles.acStatusTextPend,
                    ]}
                  >
                    {item.vapLida ? '✅ Conferida' : '⏳ Pendente'}
                  </Text>
                </View>
              </View>

              <View style={[styles.acRow, { marginTop: 8 }]}>
                <View style={styles.acParteInfo}>
                  <Text style={styles.acParteTitulo}>COND / Condensadora</Text>
                  <Text style={styles.acParteBarcode}>
                    {item.produto.codigoBarrasCond || 'Não cadastrada'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.acStatus,
                    item.condLida ? styles.acStatusOk : styles.acStatusPend,
                  ]}
                >
                  <Text
                    style={[
                      styles.acStatusText,
                      item.condLida
                        ? styles.acStatusTextOk
                        : styles.acStatusTextPend,
                    ]}
                  >
                    {item.condLida
                      ? '✅ Conferida'
                      : item.produto.codigoBarrasCond
                      ? '⏳ Pendente'
                      : '— Não cadastrada'}
                  </Text>
                </View>
              </View>

              {/* Editar COND */}
              {onSalvarCond && (
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
            </View>
          )}

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
            <Text style={styles.editTitle}>{item.produto.nome}</Text>
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

  // Seção AC
  acSection: {
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#B2DDFF',
  },

  acSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#175CD3',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  acRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  acParteInfo: {
    flex: 1,
    marginRight: 8,
  },

  acParteTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
  },

  acParteBarcode: {
    fontSize: 10,
    color: '#98A2B3',
    marginTop: 2,
  },

  acStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  acStatusOk: {
    backgroundColor: '#ECFDF3',
  },

  acStatusPend: {
    backgroundColor: '#F2F4F7',
  },

  acStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  acStatusTextOk: {
    color: '#12B76A',
  },

  acStatusTextPend: {
    color: '#98A2B3',
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
