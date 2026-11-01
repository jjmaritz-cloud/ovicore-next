
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// ============================================================
// OVICORE FEED OPERATIONS — SHARED DATABASE CATALOGUE
// ============================================================
// Data is stored in the authenticated OviCore backend database.
// Browser prototype records are NOT automatically uploaded.
//
// Global Admin:
//   Uses ?company_id=... supplied by OviCore navigation.
//
// Company users:
//   Backend resolves the company from their authenticated account.
//
// All ownership and editing permissions are enforced by the API.
// ============================================================

export type Ingredient = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  protein: string;
  energy: string;
  status: "Active" | "Inactive";
  notes: string;
};

export type Mill = {
  id: string;
  code: string;
  name: string;
  location: string;
  contact: string;
  email: string;
  phone: string;
  kind: "Company Mill" | "External Mill";
  status: "Active" | "Inactive";
  notes: string;
};

export type Ration = {
  millId: string;
  id: string;
  code: string;
  name: string;
  supplierCode: string;
  supplierName: string;
  phase: string;
  type: "Base" | "Medicated";
  baseId: string;
  status: "Draft" | "Approved" | "Inactive";
  notes: string;
  lines: {
    ingredientId: string;
    percent: number;
  }[];
};

export type Catalog = {
  ingredients: Ingredient[];
  rations: Ration[];
  mills: Mill[];
};

// Use OviCore's same-origin API proxy.
// This preserves the existing authenticated cookie flow.
const ENDPOINT = "/api/feed-operations/catalog";

const EMPTY: Catalog = {
  ingredients: [],
  rations: [],
  mills: [],
};

function isCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== "object") return false;

  const data = value as Partial<Catalog>;

  return (
    Array.isArray(data.mills) &&
    Array.isArray(data.ingredients) &&
    Array.isArray(data.rations)
  );
}

async function getApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data: unknown = await response.json();

    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;

      if (typeof detail === "string") {
        return detail;
      }
    }
  } catch {
    // Preserve the HTTP fallback when no JSON body is available.
  }

  return fallback;
}

// ============================================================
// SHARED HOOK
// ============================================================

export function useCatalog() {
  const searchParams = useSearchParams();

  const companyId = searchParams.get("company_id");

  const companyQuery = companyId
    ? `?company_id=${encodeURIComponent(companyId)}`
    : "";

  const endpoint = `${ENDPOINT}${companyQuery}`;

  const [catalog, setCatalog] = useState<Catalog>(EMPTY);
  const [loadedEndpoint, setLoadedEndpoint] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Identifies the currently selected company/API endpoint.
  const endpointRef = useRef(endpoint);

  // Invalidates responses from older loads.
  const requestVersion = useRef(0);

  // Prevents a company change from starting while a save
  // is allowed to continue against stale catalogue state.
  const savingRef = useRef(false);

  endpointRef.current = endpoint;

  const reload = useCallback(async (): Promise<boolean> => {
    const requestedEndpoint = endpoint;
    const version = ++requestVersion.current;

    setReady(false);
    setError("");

    try {
      const response = await fetch(requestedEndpoint, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
            `Feed API unavailable (HTTP ${response.status}).`
          )
        );
      }

      const data: unknown = await response.json();

      if (!isCatalog(data)) {
        throw new Error("Invalid Feed Operations catalogue response.");
      }

      // A newer company selection or request supersedes this one.
      if (
        version !== requestVersion.current ||
        requestedEndpoint !== endpointRef.current
      ) {
        return false;
      }

      setCatalog(data);
      setLoadedEndpoint(requestedEndpoint);
      setError("");
      setReady(true);

      return true;
    } catch (cause) {
      if (
        version !== requestVersion.current ||
        requestedEndpoint !== endpointRef.current
      ) {
        return false;
      }

      setCatalog(EMPTY);
      setLoadedEndpoint("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Feed Operations API unavailable."
      );
      setReady(true);

      return false;
    }
  }, [endpoint]);

  useEffect(() => {
    // Clear the previous company's records immediately.
    requestVersion.current += 1;

    setCatalog(EMPTY);
    setLoadedEndpoint("");
    setReady(false);
    setError("");

    void reload();

    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  const save = async (next: Catalog): Promise<boolean> => {
    const saveEndpoint = endpoint;

    if (
      !ready ||
      loadedEndpoint !== saveEndpoint ||
      endpointRef.current !== saveEndpoint ||
      error ||
      savingRef.current
    ) {
      setError(
        "The catalogue is not ready to save. Reload and try again."
      );
      return false;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");

    const kinds: (keyof Catalog)[] = [
      "mills",
      "ingredients",
      "rations",
    ];

    try {
      for (const kind of kinds) {
        // Never continue writing after switching companies.
        if (endpointRef.current !== saveEndpoint) {
          throw new Error(
            "Company selection changed during save. " +
            "Reload the catalogue before making further changes."
          );
        }

        const previous = new Map(
          catalog[kind].map((item) => [
            item.id,
            JSON.stringify(item),
          ])
        );

        for (const item of next[kind]) {
          if (endpointRef.current !== saveEndpoint) {
            throw new Error(
              "Company selection changed during save."
            );
          }

          // Send only created or modified records.
          if (
            previous.get(item.id) === JSON.stringify(item)
          ) {
            continue;
          }

          const url =
            `${ENDPOINT}/${kind}/${encodeURIComponent(item.id)}` +
            companyQuery;

          const response = await fetch(url, {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(item),
          });

          if (!response.ok) {
            throw new Error(
              await getApiError(
                response,
                `Save rejected (HTTP ${response.status}).`
              )
            );
          }

          // Check again after the network request completes.
          if (endpointRef.current !== saveEndpoint) {
            throw new Error(
              "Company changed while saving. " +
              "The previous company's request may have completed. " +
              "Reload before continuing."
            );
          }
        }
      }

      // A successful HTTP write is confirmed by reading
      // the persisted catalogue back from the database.
      if (endpointRef.current !== saveEndpoint) {
        return false;
      }

      return await reload();
    } catch (cause) {
      if (endpointRef.current === saveEndpoint) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save Feed Operations data."
        );
      }

      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Never expose a previous company's catalogue while
  // another company is selected or still loading.
  const currentCatalog =
    loadedEndpoint === endpoint ? catalog : EMPTY;

  return {
    catalog: currentCatalog,
    save,
    ready: ready && loadedEndpoint === endpoint,
    saving,
    error,
    reload,
  };
}

// ============================================================
// HELPERS
// ============================================================

export function newId() {
  return typeof crypto !== "undefined" &&
    "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function totalInclusion(ration: Ration) {
  return ration.lines.reduce(
    (sum, line) => sum + Number(line.percent || 0),
    0
  );
}

export function knownCost(
  ration: Ration,
  ingredients: Ingredient[]
) {
  const amounts = ration.lines.map((line) => ({
    line,
    ingredient: ingredients.find(
      (ingredient) => ingredient.id === line.ingredientId
    ),
  }));

  const complete = amounts.every(
    ({ ingredient }) =>
      !!ingredient && Number.isFinite(ingredient.price)
  );

  const cost = amounts.reduce(
    (sum, { line, ingredient }) =>
      sum +
      (ingredient?.price ?? 0) *
        line.percent /
        100,
    0
  );

  return { complete, cost };
}

// ============================================================
// COMPANY / SUPPLIER RATION IDENTITIES
// ============================================================

/**
 * Company-facing ration label for farm ordering.
 * Supplier identities are deliberately excluded.
 */
export function farmRationLabel(ration: Ration) {
  return `${ration.code} · ${ration.name}`;
}

/**
 * Supplier-facing identity for mill dispatch.
 * Never substitute the company code for a missing supplier SKU.
 */
export function supplierRationLabel(ration: Ration) {
  if (
    !ration.supplierCode?.trim() ||
    !ration.supplierName?.trim()
  ) {
    return null;
  }

  return `${ration.supplierCode} · ${ration.supplierName}`;
}

/**
 * Order snapshot for future Feed Ordering / BC integration.
 * Retains both company and supplier ration identities.
 */
export function rationOrderSnapshot(ration: Ration) {
  return {
    rationId: ration.id,
    millId: ration.millId,
    companyRationCode: ration.code,
    companyRationDescription: ration.name,
    supplierSku: ration.supplierCode,
    supplierRationDescription: ration.supplierName,
  };
}
