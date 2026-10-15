export function errMsg(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (code.includes("permission-denied")) return "Not allowed. Check the details, or the task may have changed. Reload and try again.";
  return (e as Error).message ?? "Something went wrong";
}
