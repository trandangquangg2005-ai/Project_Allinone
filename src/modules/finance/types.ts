// Plain shapes passed from server loaders to client components.

export type WalletKind = "cash" | "bank" | "ewallet" | "other";
export type CategoryKind = "income" | "expense";
export type TxKind = "income" | "expense" | "transfer";
export type TxSource = "manual" | "tutoring" | "debt";

export type WalletView = {
  id: string;
  name: string;
  kind: WalletKind;
  color: string;
  openingBalance: number;
  balance: number;
  archived: boolean;
};

export type CategoryView = {
  id: string;
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  systemKey: string | null;
  archived: boolean;
};

export type TransactionView = {
  id: string;
  kind: TxKind;
  amount: number;
  walletId: string;
  walletName: string;
  toWalletId: string | null;
  toWalletName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  occurredOn: string;
  note: string;
  source: TxSource;
};

export type DebtView = {
  id: string;
  direction: "lent" | "borrowed";
  counterparty: string;
  phone: string;
  principal: number;
  paid: number;
  remaining: number;
  occurredOn: string;
  dueOn: string | null;
  note: string;
  settled: boolean;
};

export type DebtPaymentView = {
  id: string;
  amount: number;
  paidOn: string;
  note: string;
  walletName: string | null;
};

export const WALLET_KIND_LABELS: Record<WalletKind, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  ewallet: "Ví điện tử",
  other: "Khác",
};
