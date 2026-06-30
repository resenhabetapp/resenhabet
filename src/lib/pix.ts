import { supabase } from './supabase';

/**
 * Sanitizes a city name to match BR Code requirements:
 * - UPPERCASE
 * - No accents or special characters
 * - Max 15 characters
 * - Strips any non-alphanumeric character (keeps spaces)
 */
export function sanitizeCity(city: string): string {
  if (!city || !city.trim()) return 'IVAIPORA';
  const sanitized = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '') // Keep alphanumeric and spaces
    .trim();
  return sanitized.substring(0, 15) || 'IVAIPORA';
}

/**
 * Sanitizes a receiver name to match BR Code requirements:
 * - UPPERCASE
 * - No accents or special characters
 * - Max 25 characters
 */
export function sanitizeName(name: string): string {
  if (!name || !name.trim()) return 'CONVIDADO';
  const sanitized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '') // Keep alphanumeric and spaces
    .trim();
  return sanitized.substring(0, 25) || 'CONVIDADO';
}

// Remove acentos e converte para maiúsculas (Model-based)
export function sanitize(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// Formata campo no padrão TLV (Tag, Length, Value) (Model-based)
export function tlv(id: string, value: string | number): string {
  const valStr = String(value);
  const length = String(valStr.length).padStart(2, '0');
  return id + length + valStr;
}

// Calcula o CRC16/CCITT-FALSE (Model-based)
export function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Helper to auto detect the type of Pix key based on the string format
export function autoDetectPixType(pixKey: string): string {
  const trimmed = (pixKey || '').trim();
  if (trimmed.includes('@')) return 'email';

  const clean = trimmed.replace(/\D/g, '');
  if (clean.length === 14) return 'cnpj';
  if (clean.length === 11) {
    // In Brazil, phone keys start with valid DDDs (11-99) and have 9 as 3rd digit
    const ddd = parseInt(clean.substring(0, 2), 10);
    const hasPhoneDigit = clean.charAt(2) === '9';
    if (ddd >= 11 && ddd <= 99 && hasPhoneDigit) {
      return 'celular';
    }
    return 'cpf';
  }
  if (clean.length === 10) {
    return 'celular';
  }
  if (clean.length === 32) {
    return 'random';
  }
  return 'unknown';
}

// Gera o código completo (Model-based)
export function gerarPayloadPix(
  chaveOrig: string,
  tipo: string,
  nomeOrig: string,
  cidadeOrig: string,
  valorOrig: number | string | null,
  idOrig: string
): { payloadString: string; chaveLegivel: string } {
  let chavePayload = chaveOrig;
  let chaveExibicao = chaveOrig;

  // Normalizar o tipo para bater com celular, cpf, cnpj
  let tipoLower = (tipo || '').toLowerCase();
  if (tipoLower === 'phone') {
    tipoLower = 'celular';
  }

  // Formatação de acordo com o tipo
  if (tipoLower === 'celular') {
    const numeros = chaveOrig.replace(/\D/g, '');
    if (numeros.length >= 10) {
      chavePayload = "+55" + numeros;
      chaveExibicao = `(${numeros.substring(0, 2)}) ${numeros.substring(2, 7)}-${numeros.substring(7)}`;
    }
  } else if (tipoLower === 'cpf') {
    const num = chaveOrig.replace(/\D/g, '');
    chavePayload = num;
    if (num.length === 11) {
      chaveExibicao = `${num.substring(0, 3)}.${num.substring(3, 6)}.${num.substring(6, 9)}-${num.substring(9)}`;
    }
  } else if (tipoLower === 'cnpj') {
    const num = chaveOrig.replace(/\D/g, '');
    chavePayload = num;
    if (num.length === 14) {
      chaveExibicao = `${num.substring(0, 2)}.${num.substring(2, 5)}.${num.substring(5, 8)}/${num.substring(8, 12)}-${num.substring(12)}`;
    }
  }

  const nome = sanitize(nomeOrig).substring(0, 25);
  const cidade = sanitize(cidadeOrig).substring(0, 15);
  let txid = (idOrig || "").replace(/[^A-Za-z0-9]/g, '').substring(0, 25);
  if (!txid) txid = "***";

  let payload = tlv('00', '01') + tlv('01', '11');

  const accountInfo = tlv('00', 'br.gov.bcb.pix') + tlv('01', chavePayload);
  payload += tlv('26', accountInfo);

  payload += tlv('52', '0000');
  payload += tlv('53', '986');

  if (valorOrig !== null && valorOrig !== undefined) {
    const valorOrigStr = typeof valorOrig === 'number' ? valorOrig.toString() : String(valorOrig);
    if (valorOrigStr) {
      const valorFloat = parseFloat(valorOrigStr.replace(',', '.'));
      if (!isNaN(valorFloat) && valorFloat > 0) {
        payload += tlv('54', valorFloat.toFixed(2));
      }
    }
  }

  payload += tlv('58', 'BR');
  payload += tlv('59', nome);
  payload += tlv('60', cidade);

  const additionalData = tlv('05', txid);
  payload += tlv('62', additionalData);

  payload += '6304';
  const crc = crc16(payload);
  payload += crc;

  console.log('[Pix QR Code Generator - gerarPayloadPix] Dados de entrada:', {
    chaveOrig,
    tipo,
    tipoLower,
    nomeOrig,
    cidadeOrig,
    valorOrig,
    idOrig
  });
  console.log('[Pix QR Code Generator - gerarPayloadPix] Dados formatados/gerados:', {
    chavePayload,
    chaveExibicao,
    nome,
    cidade,
    txid,
    payloadString: payload
  });

  return {
    payloadString: payload,
    chaveLegivel: chaveExibicao
  };
}

/**
 * Generates the Pix Copia e Cola (EMV BR Code) payload string
 * Keep this wrapper to avoid breaking existing callers.
 */
export function generatePixCode(
  pixKey: string,
  rawName: string,
  rawCity: string,
  value: number | null,
  txid: string,
  tipo?: string
): string {
  const detectedTipo = tipo || autoDetectPixType(pixKey);
  const result = gerarPayloadPix(pixKey, detectedTipo, rawName, rawCity, value, txid);
  return result.payloadString;
}

/**
 * Generates a unique 25-character txid following:
 * rsb_ (4) + YYYYMMDD (8) + room prefix (8) + counter (3) + et (2)
 */
export function generateTxId(roomId: string, counterValue: number): string {
  const prefix = 'rsb_';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const roomPart = roomId.substring(0, 8);
  const counterPart = String(counterValue).padStart(3, '0').substring(0, 3);
  const suffix = 'et';
  return `${prefix}${dateStr}${roomPart}${counterPart}${suffix}`;
}

/**
 * Logs a generated Pix payment to the database
 */
export async function savePixPayment(
  txid: string,
  value: number,
  userId: string | null,
  roomId: string,
  type: 'entry_fee' | 'payout'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('pix_payments')
      .insert({
        txid,
        value,
        user_id: userId,
        room_id: roomId,
        type,
      });

    if (error) {
      console.error('Error saving pix payment log:', error.message);
    }
  } catch (err) {
    console.error('Unexpected error saving pix payment log:', err);
  }
}
