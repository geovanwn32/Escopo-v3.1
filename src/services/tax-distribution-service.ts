
import type { SimplesAnnexType } from "@/types/pgdas";

type TaxDistribution = {
    [key: string]: number; // Tax Name: Percentage
};

type AnnexDistributionTable = {
    [key in SimplesAnnexType]: {
        limit: number;
        distribution: TaxDistribution;
    }[];
};

// Based on Annexes I, II, III, IV and V of Resolução CGSN Nº 140, de 22 de maio de 2018
const distributionTables: AnnexDistributionTable = {
    "anexo-i": [
        { limit: 180000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.74, 'PIS/Pasep': 2.76, CPP: 41.5, ICMS: 34 } },
        { limit: 360000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.74, 'PIS/Pasep': 2.76, CPP: 41.5, ICMS: 34 } },
        { limit: 720000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.74, 'PIS/Pasep': 2.76, CPP: 42, ICMS: 33.5 } },
        { limit: 1800000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.74, 'PIS/Pasep': 2.76, CPP: 42, ICMS: 33.5 } },
        { limit: 3600000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.74, 'PIS/Pasep': 2.76, CPP: 42, ICMS: 33.5 } },
        { limit: 4800000, distribution: { IRPJ: 13.5, CSLL: 10, Cofins: 28.27, 'PIS/Pasep': 6.13, CPP: 42.1, ICMS: 0 } },
    ],
    "anexo-ii": [
        { limit: 180000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.82, 'PIS/Pasep': 2.78, CPP: 37.5, IPI: 7.9 } },
        { limit: 360000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.82, 'PIS/Pasep': 2.78, CPP: 37.5, IPI: 7.9 } },
        { limit: 720000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.82, 'PIS/Pasep': 2.78, CPP: 37.5, IPI: 7.9 } },
        { limit: 1800000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.82, 'PIS/Pasep': 2.78, CPP: 37.5, IPI: 7.9 } },
        { limit: 3600000, distribution: { IRPJ: 5.5, CSLL: 3.5, Cofins: 12.82, 'PIS/Pasep': 2.78, CPP: 37.5, IPI: 7.9 } },
        { limit: 4800000, distribution: { IRPJ: 8.5, CSLL: 7.5, Cofins: 24.84, 'PIS/Pasep': 5.36, CPP: 23.8, IPI: 30 } },
    ],
    "anexo-iii": [
        { limit: 180000, distribution: { IRPJ: 4, CSLL: 3.5, Cofins: 12.82, 'PIS/Pasep': 2.78, CPP: 43.4, ISS: 33.5 } },
        { limit: 360000, distribution: { IRPJ: 4, CSLL: 3.5, Cofins: 14.05, 'PIS/Pasep': 3.05, CPP: 43.4, ISS: 32 } },
        { limit: 720000, distribution: { IRPJ: 4, CSLL: 3.5, Cofins: 13.64, 'PIS/Pasep': 2.96, CPP: 43.4, ISS: 32.5 } },
        { limit: 1800000, distribution: { IRPJ: 4, CSLL: 3.5, Cofins: 13.64, 'PIS/Pasep': 2.96, CPP: 43.4, ISS: 32.5 } },
        { limit: 3600000, distribution: { IRPJ: 35, CSLL: 15, Cofins: 16.03, 'PIS/Pasep': 3.47, CPP: 30.5, ISS: 0 } },
        { limit: 4800000, distribution: { IRPJ: 35, CSLL: 15, Cofins: 16.03, 'PIS/Pasep': 3.47, CPP: 30.5, ISS: 0 } },
    ],
    "anexo-iv": [
        { limit: 180000, distribution: { IRPJ: 38.45, CSLL: 21.5, Cofins: 20.21, 'PIS/Pasep': 4.34, ISS: 15.5 } },
        { limit: 360000, distribution: { IRPJ: 31.45, CSLL: 21.5, Cofins: 22.35, 'PIS/Pasep': 4.7, ISS: 20 } },
        { limit: 720000, distribution: { IRPJ: 32.45, CSLL: 20.5, Cofins: 21.28, 'PIS/Pasep': 4.52, ISS: 21.25 } },
        { limit: 1800000, distribution: { IRPJ: 32.45, CSLL: 20.5, Cofins: 21.28, 'PIS/Pasep': 4.52, ISS: 21.25 } },
        { limit: 3600000, distribution: { IRPJ: 34.45, CSLL: 19.5, Cofins: 19.95, 'PIS/Pasep': 4.2, ISS: 21.9 } },
        { limit: 4800000, distribution: { IRPJ: 37, CSLL: 21, Cofins: 20.56, 'PIS/Pasep': 4.44, ISS: 17 } },
    ],
    "anexo-v": [
        { limit: 180000, distribution: { IRPJ: 25, CSLL: 15, Cofins: 14.1, 'PIS/Pasep': 3.05, CPP: 28.85, ISS: 14 } },
        { limit: 360000, distribution: { IRPJ: 21, CSLL: 15, Cofins: 14.92, 'PIS/Pasep': 3.23, CPP: 30.5, ISS: 15.35 } },
        { limit: 720000, distribution: { IRPJ: 23, CSLL: 15, Cofins: 14.1, 'PIS/Pasep': 3.05, CPP: 29.5, ISS: 15.35 } },
        { limit: 1800000, distribution: { IRPJ: 24, CSLL: 15, Cofins: 14.92, 'PIS/Pasep': 3.23, CPP: 27.5, ISS: 15.35 } },
        { limit: 3600000, distribution: { IRPJ: 22, CSLL: 15, Cofins: 15.37, 'PIS/Pasep': 3.33, CPP: 30.5, ISS: 13.8 } },
        { limit: 4800000, distribution: { IRPJ: 35, CSLL: 15.5, Cofins: 16.93, 'PIS/Pasep': 3.67, CPP: 28.9, ISS: 0 } },
    ]
};

export function getTaxDistribution(annex: SimplesAnnexType, rbt12: number): TaxDistribution {
    const table = distributionTables[annex];
    if (!table) {
        throw new Error(`Tabela de distribuição de impostos não encontrada para o anexo: ${annex}`);
    }

    for (const bracket of table) {
        if (rbt12 <= bracket.limit) {
            return bracket.distribution;
        }
    }
    
    // Return the last bracket if rbt12 is over the limit
    return table[table.length - 1].distribution;
}
