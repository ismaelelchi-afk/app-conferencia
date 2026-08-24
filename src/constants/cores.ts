import type { StatusLeitura } from '@/models/produto';

export const CORES_STATUS: Record<
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
