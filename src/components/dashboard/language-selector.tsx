"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_LANGUAGES, languageLabel } from "@/lib/languages";
import { setDefaultLanguageAction } from "@/app/(app)/w/[workspaceId]/actions";

export function LanguageSelector({ workspaceId, currentLanguage }: { workspaceId: string; currentLanguage: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(language: string) {
    if (language === currentLanguage) return;
    startTransition(async () => {
      await setDefaultLanguageAction(workspaceId, language);
      toast.success(`Las próximas publicaciones se generarán en ${languageLabel(language)}`);
      router.refresh();
    });
  }

  return (
    <Select value={currentLanguage} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-44" aria-label="Idioma de las publicaciones">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
