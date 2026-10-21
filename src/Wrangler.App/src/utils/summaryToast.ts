import { toast } from "react-toastify";

/**
 * One success toast for a batch: the item itself when there is only one,
 * otherwise a count, so a bulk action doesn't fill the screen.
 */
export const summaryToast = <T,>(items: T[], describe: (item: T) => string, plural: string) => {
  if (items.length === 0) return;
  toast.success(items.length === 1 ? describe(items[0]) : `${items.length} ${plural}`);
};
