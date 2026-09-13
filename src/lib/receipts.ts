import { supabase } from "@/integrations/supabase/client";

/** Bucket privado: un ticket lleva comercio, fecha, hora y a veces digitos de la tarjeta. */
export const RECEIPTS_BUCKET = "receipts";

/** Cuanto vive la URL firmada que se le pasa al <img>. Una hora alcanza para mirarlo. */
export const RECEIPT_SIGNED_URL_TTL = 60 * 60;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/**
 * Sube la foto del ticket y devuelve su PATH dentro del bucket (no una URL): el bucket es
 * privado, asi que lo que se guarda en `transactions.receipt_url` es la llave y la URL se
 * firma al mostrarla. Guardar una URL firmada seria guardar algo que vence.
 *
 * El primer segmento del path es el user_id porque de eso dependen las policies de storage.
 */
export async function uploadReceipt(file: File, userId: string): Promise<string> {
  const ext = EXT_BY_MIME[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

/** Firma el path guardado para poder mostrarlo. Devuelve null si el objeto ya no esta. */
export async function signReceipt(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, RECEIPT_SIGNED_URL_TTL);

  if (error) return null;
  return data?.signedUrl ?? null;
}
