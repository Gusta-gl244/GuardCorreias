import { useCallback, useEffect, useState } from 'react';
import { rolesAPI } from '@/api/client';
import type { PermissionMatrix, PermissionModule } from '@/app/data/types';

const CACHE_KEY = 'guardcorreias_permissions';

interface CachedRole {
  name: string;
  baseShell: string;
  permissions: PermissionMatrix;
}

function readCache(): CachedRole | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedRole) : null;
  } catch {
    return null;
  }
}

function writeCache(role: CachedRole) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(role));
  } catch {
    // silent fail — cache é só um atalho para uso offline
  }
}

/**
 * Matriz de permissões do usuário logado, buscada em /api/roles/me. Fica em
 * cache local (localStorage) para continuar funcionando offline — um
 * técnico em campo sem sinal não pode perder acesso às próprias telas só
 * porque não conseguiu buscar de novo a matriz mais recente. A matriz em si
 * (o que cada rota aceita) sempre é conferida de novo no servidor a cada
 * requisição — este hook só controla o que a UI mostra/esconde.
 */
export function usePermissions() {
  const [role, setRole] = useState<CachedRole | null>(() => readCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    rolesAPI
      .getMine()
      .then((fetched: CachedRole) => {
        if (cancelled) return;
        setRole(fetched);
        writeCache(fetched);
      })
      .catch(() => {
        // offline ou erro — mantém o que já estava em cache (se houver)
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const can = useCallback(
    (module: PermissionModule, action: keyof PermissionMatrix[PermissionModule] & string) => {
      return !!role?.permissions?.[module]?.[action as 'view' | 'create' | 'edit' | 'delete'];
    },
    [role]
  );

  return { role, permissions: role?.permissions ?? {}, can, loading };
}
