/**
 * Idiomas soportados de forma "nativa" por los proveedores de IA de la
 * aplicación. `MockAIProvider` solo tiene plantillas propias para `es` y
 * `en`; para el resto degrada de forma honesta (ver mock.ts). El proveedor
 * real (`AnthropicAIProvider`) redacta con fluidez en cualquiera de estos
 * idiomas, ya que solo cambia la instrucción del prompt.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ca", label: "Català" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function languageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
