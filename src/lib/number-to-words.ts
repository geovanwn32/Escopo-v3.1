
const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZENAS = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const ESPECIAIS = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function toWords(num: number): string {
    if (num === 0) return "";
    if (num < 10) return UNIDADES[num];
    if (num < 20) return ESPECIAIS[num - 10];
    if (num < 100) {
        const dezena = Math.floor(num / 10);
        const unidade = num % 10;
        return DEZENAS[dezena] + (unidade > 0 ? " e " + UNIDADES[unidade] : "");
    }
    if (num < 1000) {
        const centena = Math.floor(num / 100);
        const resto = num % 100;
        if (num === 100) return "cem";
        return CENTENAS[centena] + (resto > 0 ? " e " + toWords(resto) : "");
    }
    return "";
}

export function numberToWords(value: number): string {
    if (isNaN(value) || value === null) return '';

    const integerPart = Math.floor(value);
    const fractionalPart = Math.round((value - integerPart) * 100);

    let words = '';

    if (integerPart > 0) {
        let tempInteger = integerPart;
        const thousands = Math.floor(tempInteger / 1000);
        if (thousands > 0) {
            words += (thousands === 1 ? "mil" : toWords(thousands) + " mil");
            tempInteger %= 1000;
        }

        if (thousands > 0 && tempInteger > 0) {
             if (tempInteger < 100 || tempInteger % 100 === 0) {
                words += " e ";
            } else {
                 words += ", ";
            }
        }
        
        words += toWords(tempInteger);
        words += integerPart === 1 ? " real" : " reais";
    }

    if (fractionalPart > 0) {
        if (integerPart > 0) {
            words += " e ";
        }
        words += toWords(fractionalPart);
        words += fractionalPart === 1 ? " centavo" : " centavos";
    }
    
    // Capitalize the first letter
    return words.charAt(0).toUpperCase() + words.slice(1);
}
