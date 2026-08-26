import type { NfItem } from '@/models/produto';

export type ItemLido = {
  codigoInterno: string;
  quantidade: number;
};

export type ResultadoComparacao = {
  faltantes: { codigoInterno: string; esperado: number; lido: number }[];
  sobrantes: { codigoInterno: string; esperado: number; lido: number }[];
  naoEsperados: { codigoInterno: string; lido: number }[];
  coincidentes: number;
};

export function compararConferencia(
  lidos: ItemLido[],
  esperados: NfItem[],
): ResultadoComparacao {
  // Agrupa lidos por codigoInterno (pode vir de pares AC, etc.)
  const mapLidos = new Map<string, number>();
  for (const l of lidos) {
    mapLidos.set(l.codigoInterno, (mapLidos.get(l.codigoInterno) ?? 0) + l.quantidade);
  }

  const mapEsperados = new Map<string, number>();
  for (const e of esperados) {
    mapEsperados.set(e.codigoInterno, e.quantidadeEsperada);
  }

  const faltantes: ResultadoComparacao['faltantes'] = [];
  const sobrantes: ResultadoComparacao['sobrantes'] = [];
  let coincidentes = 0;

  // Compara todos os esperados contra os lidos.
  for (const [codigo, esperado] of mapEsperados.entries()) {
    const lido = mapLidos.get(codigo) ?? 0;
    if (lido < esperado) {
      faltantes.push({ codigoInterno: codigo, esperado, lido });
    } else if (lido > esperado) {
      sobrantes.push({ codigoInterno: codigo, esperado, lido });
    } else {
      coincidentes++;
    }
  }

  // Lidos que não estão na NF.
  const naoEsperados: ResultadoComparacao['naoEsperados'] = [];
  for (const [codigo, lido] of mapLidos.entries()) {
    if (!mapEsperados.has(codigo)) {
      naoEsperados.push({ codigoInterno: codigo, lido });
    }
  }

  // Ordena por codigoInterno para exibição consistente.
  faltantes.sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));
  sobrantes.sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));
  naoEsperados.sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));

  return { faltantes, sobrantes, naoEsperados, coincidentes };
}
