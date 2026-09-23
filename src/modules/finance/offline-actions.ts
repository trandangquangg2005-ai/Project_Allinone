"use client";

import { queued } from "@/lib/offline/wrap";
import * as server from "./actions";

// Import these instead of ./actions from client components: same call, but a
// write made with no signal waits in the queue instead of being lost.

export const saveTransaction = queued("saveTransaction", "Giao dịch", server.saveTransaction);
export const deleteTransaction = queued("deleteTransaction", "Xóa giao dịch", server.deleteTransaction);
export const saveWallet = queued("saveWallet", "Ví", server.saveWallet);
export const archiveWallet = queued("archiveWallet", "Ẩn/hiện ví", server.archiveWallet);
export const deleteWallet = queued("deleteWallet", "Xóa ví", server.deleteWallet);
export const saveCategory = queued("saveCategory", "Danh mục", server.saveCategory);
export const archiveCategory = queued("archiveCategory", "Ẩn/hiện danh mục", server.archiveCategory);
export const saveDebt = queued("saveDebt", "Khoản nợ", server.saveDebt);
export const addDebtPayment = queued("addDebtPayment", "Trả nợ", server.addDebtPayment);
export const deleteDebtPayment = queued("deleteDebtPayment", "Xóa lần trả nợ", server.deleteDebtPayment);
export const deleteDebt = queued("deleteDebt", "Xóa khoản nợ", server.deleteDebt);
export const setDebtSettled = queued("setDebtSettled", "Trạng thái nợ", server.setDebtSettled);
