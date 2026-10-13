import type { Client, TaskStatus } from "@/lib/types";
import { STATUS_LABEL, STATUS_STYLE, type Flag } from "@/lib/utils";

export function ClientBadge({ client }: { client: Pick<Client, "name" | "logo_url"> }) {
  return (
    <span className="inline-flex items-center gap-2">
      {client.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={client.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-xs font-semibold text-slate-600">
          {client.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="font-medium">{client.name}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function FlagPill({ flag }: { flag: Flag }) {
  if (!flag) return null;
  return flag === "overdue" ? (
    <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">Overdue</span>
  ) : (
    <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-medium text-white">Due soon</span>
  );
}

export function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
}
